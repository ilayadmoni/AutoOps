import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bot, MessageSquarePlus, Search, Send, Server, TerminalSquare, Trash2, Workflow } from 'lucide-react';
import { ApiError, del, get, post } from '../../shared/api/client';
import type { AIOperation, ChatReply, ConversationSummary, ConversationView, MissingField, WorkflowNode } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { ErrorAlert, RiskBadge, Spinner } from '../../shared/ui';
import { setAiDraft, getCurrentDraft } from '../workflows/draftStore';
import RunCommandModal, { type RunCommandInitial } from '../commands/RunCommandModal';

type Msg = { role: 'user' | 'assistant'; content: string; operations?: AIOperation[] };

/** Minimal safe formatting: `code` and **bold** only; everything else is plain text. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => p.startsWith('`') && p.endsWith('`') ? <code key={i} dir="ltr" className="code">{p.slice(1, -1)}</code>
        : p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong>
        : <Fragment key={i}>{p}</Fragment>)}
    </>
  );
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
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const open = async (id: number) => {
    const c = await get<ConversationView>('/ai/conversations/' + id);
    setConversationId(id);
    setMessages(c.messages.map((m) => ({ role: m.role, content: m.content, operations: m.operations })));
  };
  const remove = useMutation({
    mutationFn: (id: number) => del('/ai/conversations/' + id),
    onSuccess: (_, id) => {
      if (id === conversationId) { setConversationId(null); setMessages([]); }
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
  const submit = (e?: FormEvent, value = text) => {
    e?.preventDefault();
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
    setRunInitial({ commandId: p.commandDefinitionId, machineIds: p.machineIds ?? [], parameters: p.parameters ?? {}, runWithSudo: p.runWithSudo });
  };
  const notConfigured = status.data && !status.data.configured;

  return (
    <section className="assistant">
      <aside className="conversations">
        <button className="btn primary" onClick={() => { setConversationId(null); setMessages([]); }}><MessageSquarePlus size={16} /> {t('ai.newChat')}</button>
        <div className="list tight">
          {(conversations.data ?? []).map((c) => (
            <div key={c.id} className={'convItem' + (c.id === conversationId ? ' active' : '')}>
              <button className="btn ghost grow start" onClick={() => open(c.id)}>{c.title}</button>
              <button className="icon" aria-label={t('common.delete')} onClick={() => remove.mutate(c.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </aside>
      <div className="chat">
        {messages.length === 0 && (
          <div className="hero">
            <div className="orb"><Bot /></div>
            <h1>{t('ai.title')}</h1>
            <p className="muted">{t('ai.subtitle')}</p>
            <div className="actions">
              <button className="btn" onClick={() => submit(undefined, t('ai.quick.find'))}><Search size={16} /> {t('ai.quickFind')}</button>
              <button className="btn" onClick={() => submit(undefined, t('ai.quick.workflow'))}><Workflow size={16} /> {t('ai.quickWorkflow')}</button>
              <button className="btn" onClick={() => submit(undefined, t('ai.quick.explain'))}><TerminalSquare size={16} /> {t('ai.quickExplain')}</button>
              <button className="btn" onClick={() => submit(undefined, t('ai.quick.machines'))}><Server size={16} /> {t('ai.quickMachines')}</button>
            </div>
          </div>
        )}
        {notConfigured && <div className="alert info">{t('ai.notConfigured')}</div>}
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={'message ' + m.role}>
              <b>{m.role === 'user' ? t('ai.you') : 'AutoOps'}</b>
              <p><Rich text={m.content} /></p>
              {m.operations?.map((op, j) => (
                <Proposal key={j} op={op} onWorkflow={() => reviewWorkflow(op)} onRun={() => reviewRun(op)} />
              ))}
            </div>
          ))}
          {send.isPending && <div className="message assistant"><Spinner /> {t('ai.thinking')}</div>}
          {send.error && <ErrorAlert error={send.error as ApiError} />}
          <div ref={end} />
        </div>
        <form className="composer" onSubmit={submit}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ai.placeholder')} maxLength={4000} disabled={!!notConfigured} />
          <button className="btn primary" disabled={send.isPending || !text.trim() || !!notConfigured}><Send size={16} /> {t('ai.send')}</button>
        </form>
      </div>
      {runInitial && <RunCommandModal initial={runInitial} onClose={() => setRunInitial(null)} />}
    </section>
  );
}

function Missing({ fields }: { fields: MissingField[] }) {
  const { t } = useI18n();
  if (!fields.length) return null;
  return (
    <div className="alert warn small">
      <div>
        <strong>{t('ai.missing')}</strong>
        <ul>{fields.map((f, i) => <li key={i}>{f.nodeKey && <code dir="ltr">{f.nodeKey}</code>} <code dir="ltr">{f.field}</code>: {f.message}</li>)}</ul>
      </div>
    </div>
  );
}

function Proposal({ op, onWorkflow, onRun }: { op: AIOperation; onWorkflow: () => void; onRun: () => void }) {
  const { t } = useI18n();
  let body: ReactNode = null;
  if (op.type === 'REPLACE_WORKFLOW_DRAFT') {
    const p = op.payload as { name?: string; nodes?: WorkflowNode[] };
    body = (
      <>
        <b>{t('ai.proposedWorkflow')}: {p.name}</b>
        <ol>{(p.nodes ?? []).map((n) => <li key={n.key}>{t('steps.' + n.type, undefined, n.type)} — {n.name}</li>)}</ol>
        <Missing fields={op.missingFields} />
        <button className="btn primary small" onClick={onWorkflow}>{t('ai.reviewInBuilder')}</button>
      </>
    );
  } else if (op.type === 'PROPOSE_COMMAND_RUN') {
    const p = op.payload as { commandName?: string; preview?: string; riskLevel?: string; machineIds?: number[] };
    body = (
      <>
        <b>{t('ai.proposedRun')}: {p.commandName}</b> <RiskBadge risk={p.riskLevel} />
        {p.preview && <div><code dir="ltr" className="code">{p.preview}</code></div>}
        <small className="muted">{t('ai.onMachines', { n: p.machineIds?.length ?? 0 })}</small>
        <Missing fields={op.missingFields} />
        <button className="btn primary small" onClick={onRun}>{t('ai.reviewRun')}</button>
      </>
    );
  }
  return <div className="proposal"><small className="muted">{t('ai.proposalNote')}</small>{body}</div>;
}
