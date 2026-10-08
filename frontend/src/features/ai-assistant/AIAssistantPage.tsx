import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { History, MessageSquarePlus, Workflow as WorkflowIcon } from 'lucide-react';
import { ApiError, del, get, post } from '../../shared/api/client';
import type { AIOperation, ChatReply, ConversationSummary, ConversationView, WorkflowNode } from '../../shared/api/types';
import { ErrorAlert, IconButton } from '../../shared/ui';
import { setAiDraft, getCurrentDraft } from '../workflows/draftStore';
import RunCommandModal, { type RunCommandInitial } from '../commands/RunCommandModal';
import ConversationRail from './ConversationRail';
import ChatMessage, { ThinkingMessage, type Msg } from './ChatMessage';
import ChatHero from './ChatHero';
import Composer from './Composer';
import WorkflowPreview from './WorkflowPreview';
import { useWorkflowCanvas } from './useWorkflowCanvas';
import { useI18n } from '../../i18n/I18nProvider';

/** Below this width the rail would squeeze the thread, so it starts collapsed. */
const RAIL_MIN_VIEWPORT = 1180;
const RAIL_KEY = 'autoops.ai.historyOpen';

/** The user's last explicit choice wins; without one, the rail opens only on wide screens. */
function initialRail() {
  try {
    const saved = localStorage.getItem(RAIL_KEY);
    if (saved === '1' || saved === '0') return saved === '1';
  } catch {
    // storage unavailable
  }
  return window.innerWidth >= RAIL_MIN_VIEWPORT;
}

function rememberRail(open: boolean) {
  try {
    localStorage.setItem(RAIL_KEY, open ? '1' : '0');
  } catch {
    // storage unavailable
  }
}

export default function AIAssistantPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['ai', 'status'], queryFn: () => get<{ configured: boolean }>('/ai/status') });
  const conversations = useQuery({ queryKey: ['ai', 'conversations'], queryFn: () => get<ConversationSummary[]>('/ai/conversations') });
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [runInitial, setRunInitial] = useState<RunCommandInitial | null>(null);
  const [railOpen, setRailOpen] = useState(initialRail);
  const scroller = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: (message: string) => {
      const draft = getCurrentDraft();
      return post<ChatReply>('/ai/chat', { conversationId, message, draftSummary: draft ? JSON.stringify(draft) : null });
    },
    onMutate: (message) => setMessages((m) => [...m, { role: 'user', content: message }]),
    onSuccess: (r) => {
      setConversationId(r.conversationId);
      setMessages((m) => [...m, { role: 'assistant', content: r.message, operations: r.operations }]);
      qc.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    },
  });

  const canvas = useWorkflowCanvas(messages, send.isPending ? send.variables ?? null : null);

  // Scroll the thread itself. scrollIntoView would also scroll every ancestor (the page body, the
  // shell), which pushed the app header and the sidebar brand out of view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || (messages.length === 0 && !send.isPending)) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, send.isPending]);

  // The canvas needs the room: collapse history when the split opens.
  useEffect(() => {
    if (canvas.open) setRailOpen(false);
  }, [canvas.open]);

  const toggleRail = (open: boolean) => {
    setRailOpen(open);
    rememberRail(open);
  };

  const reset = () => {
    setConversationId(null);
    setMessages([]);
    canvas.reset();
    send.reset();
  };

  const open = async (id: number) => {
    const c = await get<ConversationView>('/ai/conversations/' + id);
    canvas.reset();
    setConversationId(id);
    setMessages(c.messages.map((m) => ({ role: m.role, content: m.content, operations: m.operations })));
  };

  const remove = useMutation({
    mutationFn: (id: number) => del('/ai/conversations/' + id),
    onSuccess: (_, id) => {
      if (id === conversationId) reset();
      qc.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    },
  });

  const submit = (value = text) => {
    if (!value.trim() || send.isPending) return;
    setText('');
    send.mutate(value.trim());
  };

  const reviewWorkflow = (op: AIOperation) => {
    const p = op.payload as { name?: string; description?: string; nodes?: WorkflowNode[] };
    setAiDraft({ name: p.name ?? 'AI draft', description: p.description ?? '', nodes: p.nodes ?? [] });
    nav('/workflows/new');
  };

  const reviewRun = (op: AIOperation) => {
    const p = op.payload as { commandDefinitionId: number; machineIds?: number[]; parameters?: Record<string, string>; runWithSudo?: boolean };
    setRunInitial({
      commandId: p.commandDefinitionId,
      machineIds: p.machineIds ?? [],
      parameters: p.parameters ?? {},
      runWithSudo: p.runWithSudo,
    });
  };

  const notConfigured = !!status.data && !status.data.configured;
  const title = conversations.data?.find((c) => c.id === conversationId)?.title;
  const classes = ['assistant', 'fillPage', railOpen ? 'withRail' : '', canvas.open ? 'split' : ''].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      {railOpen && (
        <ConversationRail
          items={conversations.data ?? []}
          loading={conversations.isLoading}
          activeId={conversationId}
          onOpen={open}
          onDelete={(id) => remove.mutate(id)}
          onCollapse={() => toggleRail(false)}
        />
      )}
      <div className="chat">
        <header className="chatBar">
          {!railOpen && (
            <IconButton label={t('ai.showHistory')} onClick={() => toggleRail(true)}>
              <History size={17} />
            </IconButton>
          )}
          <span className="chatTitle">{title ?? t('ai.newChat')}</span>
          {canvas.hasDraft && !canvas.open && (
            <IconButton label={t('ai.showCanvas')} onClick={canvas.reopen}><WorkflowIcon size={17} /></IconButton>
          )}
          <IconButton label={t('ai.newChat')} onClick={reset}><MessageSquarePlus size={17} /></IconButton>
        </header>
        <div className="chatScroll" ref={scroller}>
          <div className={'chatInner' + (messages.length === 0 ? ' isEmpty' : '')}>
            {notConfigured && <div className="alert info">{t('ai.notConfigured')}</div>}
            {messages.length === 0 && !notConfigured && <ChatHero onPick={submit} />}
            {messages.map((m, i) => (
              <ChatMessage
                key={i}
                msg={m}
                onCanvas={canvas.open && canvas.draft?.messageIndex === i}
                onShow={() => canvas.show(i)}
                onWorkflow={reviewWorkflow}
                onRun={reviewRun}
              />
            ))}
            {send.isPending && <ThinkingMessage />}
            {send.error && <ErrorAlert error={send.error as ApiError} />}
          </div>
        </div>
        <Composer
          value={text}
          onChange={setText}
          onSubmit={() => submit()}
          disabled={notConfigured}
          busy={send.isPending}
        />
      </div>
      {canvas.open && (
        <WorkflowPreview
          draft={canvas.draft}
          building={canvas.building}
          onOpenBuilder={() => canvas.draft && reviewWorkflow(canvas.draft.op)}
          onClose={canvas.close}
        />
      )}
      {runInitial && <RunCommandModal initial={runInitial} onClose={() => setRunInitial(null)} />}
    </section>
  );
}
