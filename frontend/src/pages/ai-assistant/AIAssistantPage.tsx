import { useEffect, useRef, useState } from 'react';
import { History, MessageSquarePlus, Workflow as WorkflowIcon } from 'lucide-react';
import { ApiError } from '../../services/client';
import type { AIOperation } from '../../types/api';
import { ErrorAlert, IconButton, errorMessage } from '../../components/ui';
import RunCommandModal from '../../features/commands/RunCommandModal';
import ConversationRail from '../../features/ai-assistant/ConversationRail';
import ChatMessage, { ThinkingMessage } from '../../features/ai-assistant/ChatMessage';
import ChatHero from '../../features/ai-assistant/ChatHero';
import Composer from '../../features/ai-assistant/Composer';
import MachineForm, { type MachineDraft } from '../../features/machines/MachineForm';
import WorkflowWorkspace from '../../features/ai-assistant/workspace/WorkflowWorkspace';
import { proposalOf } from '../../features/ai-assistant/workspace/model';
import { forgetWorkspace } from '../../features/ai-assistant/workspace/store';
import { useWorkflowWorkspace } from '../../features/ai-assistant/workspace/useWorkflowWorkspace';
import { useChatSession } from '../../features/ai-assistant/useChatSession';
import { useProposalActions } from '../../features/ai-assistant/useProposalActions';
import { useConversationRail } from '../../features/ai-assistant/useConversationRail';
import { useI18n } from '../../app/providers/I18nProvider';

const isDraft = (op: AIOperation) => op.type === 'REPLACE_WORKFLOW_DRAFT';

export default function AIAssistantPage() {
  const { t } = useI18n();
  const workspace = useWorkflowWorkspace();
  const [closed, setClosed] = useState(false);
  const session = useChatSession({
    prepare: (text, refs) => {
      setClosed(false);
      return workspace.begin(text, refs.servers.map((s) => ({ id: s.id, name: s.label })), refs.files.map((f) => ({ id: f.id, name: f.label })));
    },
    onReply: (reply, request, current) => {
      if (current) workspace.bind(reply.conversationId);
      const op = reply.operations.filter(isDraft).at(-1);
      if (op) { workspace.receive(reply.conversationId, op, request.revision, current); if (current) setClosed(false); }
    },
    onFail: (error, _request, current) => {
      if (!current) return;
      workspace.dispatch({ type: 'failure', failure: { message: errorMessage(error), code: error instanceof ApiError ? error.code : undefined } });
      setClosed(false);
    },
  });
  const { status, conversations, conversationId, messages, send, attach, remove, submit } = session;
  const { actions, reviewWorkflow, runInitial, setRunInitial, machineOp, setMachineOp, markAdded } = useProposalActions(submit, send.isPending);
  const { railOpen, setRailOpen, toggleRail } = useConversationRail();
  const scroller = useRef<HTMLDivElement>(null);
  const started = workspace.state.started;
  const open = started && !closed;
  const reset = () => { session.reset(); workspace.reset(); setClosed(false); };
  const openConversation = async (id: number) => { workspace.restore(id, await session.open(id)); setClosed(false); };
  const showProposal = (op: AIOperation) => {
    if (workspace.state.nodes.length && !window.confirm(t('ai.replaceDraftConfirm'))) return;
    workspace.dispatch({ type: 'apply', proposal: proposalOf(op) }); setClosed(false);
  };
  useEffect(() => {
    const el = scroller.current;
    if (el && (messages.length > 0 || send.isPending)) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, send.isPending, session.failed]);
  useEffect(() => { if (open) setRailOpen(false); }, [open]);
  const notConfigured = !!status.data && !status.data.configured;
  const title = conversations.data?.find((c) => c.id === conversationId)?.title;
  const classes = ['assistant', 'fillPage', railOpen ? 'withRail' : '', open ? 'split' : ''].filter(Boolean).join(' ');
  const lastDraft = messages.reduce((found, m, i) => (m.operations?.some(isDraft) ? i : found), -1);

  return (
    <section className={classes}>
      {railOpen && (
        <ConversationRail
          items={conversations.data ?? []}
          loading={conversations.isLoading}
          activeId={conversationId}
          onOpen={openConversation}
          onDelete={(id) => remove.mutate(id, { onSuccess: () => forgetWorkspace(id) })}
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
          {started && closed && <IconButton label={t('ai.showCanvas')} onClick={() => setClosed(false)}><WorkflowIcon size={17} /></IconButton>}
          <IconButton label={t('ai.newChat')} onClick={reset}><MessageSquarePlus size={17} /></IconButton>
        </header>
        <div className="chatScroll" ref={scroller}>
          <div className={'chatInner' + (messages.length === 0 ? ' isEmpty' : '')}>
            {notConfigured && <div className="alert info">{t('ai.notConfigured')}</div>}
            {messages.length === 0 && !notConfigured && <ChatHero />}
            {messages.map((m, i) => (
              <ChatMessage
                key={i}
                msg={m}
                reply={messages[i + 1]?.role === 'user' ? messages[i + 1].content : undefined}
                failed={session.failed && i === messages.length - 1 && m.role === 'user'}
                onCanvas={open && i === lastDraft}
                onShow={() => { const op = m.operations?.find(isDraft); if (op) showProposal(op); }}
                actions={actions}
              />
            ))}
            {send.isPending && <ThinkingMessage />}
            {session.failed && <ErrorAlert error={session.error} onRetry={session.retry} />}
          </div>
        </div>
        <Composer
          doc={session.doc}
          onChange={session.setDoc}
          onSubmit={() => submit()}
          disabled={notConfigured}
          busy={send.isPending}
          uploading={attach.isPending ? attach.variables?.name ?? null : null}
          onUpload={(file) => attach.mutateAsync(file)}
        />
      </div>
      {open && (
        <WorkflowWorkspace
          state={workspace.state} dispatch={workspace.dispatch} change={workspace.change}
          building={send.isPending} canRetry={session.failed} onRetry={session.retry}
          onClose={() => setClosed(true)}
        />
      )}
      {runInitial && <RunCommandModal initial={runInitial} onClose={() => setRunInitial(null)} />}
      {machineOp && (
        <MachineForm
          machine={null} initial={machineOp.payload as MachineDraft}
          onClose={() => setMachineOp(null)} onSaved={() => markAdded(machineOp)}
        />
      )}
    </section>
  );
}
