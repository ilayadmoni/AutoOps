import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, del, get, post } from '../../shared/api/client';
import type { AIOperation, ChatReply, ConversationSummary, ConversationView, WorkflowNode } from '../../shared/api/types';
import { ErrorAlert } from '../../shared/ui';
import { setAiDraft, getCurrentDraft } from '../workflows/draftStore';
import RunCommandModal, { type RunCommandInitial } from '../commands/RunCommandModal';
import ConversationRail from './ConversationRail';
import ChatMessage, { ThinkingMessage, type Msg } from './ChatMessage';
import ChatHero from './ChatHero';
import Composer from './Composer';
import { useI18n } from '../../i18n/I18nProvider';

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
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const open = async (id: number) => {
    const c = await get<ConversationView>('/ai/conversations/' + id);
    setConversationId(id);
    setMessages(c.messages.map((m) => ({ role: m.role, content: m.content, operations: m.operations })));
  };

  const remove = useMutation({
    mutationFn: (id: number) => del('/ai/conversations/' + id),
    onSuccess: (_, id) => {
      if (id === conversationId) {
        setConversationId(null);
        setMessages([]);
      }
      qc.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    },
  });

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

  return (
    <section className="assistant">
      <ConversationRail
        items={conversations.data ?? []}
        activeId={conversationId}
        onOpen={open}
        onNew={() => { setConversationId(null); setMessages([]); }}
        onDelete={(id) => remove.mutate(id)}
      />
      <div className="chat">
        <div className="chatScroll">
          <div className="chatInner">
            {notConfigured && <div className="alert info">{t('ai.notConfigured')}</div>}
            {messages.length === 0 && !notConfigured && <ChatHero onPick={submit} />}
            {messages.map((m, i) => (
              <ChatMessage key={i} msg={m} onWorkflow={reviewWorkflow} onRun={reviewRun} />
            ))}
            {send.isPending && <ThinkingMessage />}
            {send.error && <ErrorAlert error={send.error as ApiError} />}
            <div ref={end} />
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
      {runInitial && <RunCommandModal initial={runInitial} onClose={() => setRunInitial(null)} />}
    </section>
  );
}
