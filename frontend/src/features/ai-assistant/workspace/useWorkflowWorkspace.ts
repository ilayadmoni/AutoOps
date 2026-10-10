import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { AIOperation, WorkflowNode } from '../../../types/api';
import { draftContext, initialState, proposalOf, reducer, type Action, type Ref, type WorkspaceState } from './model';
import { loadWorkspace, saveWorkspace } from './store';

/** Words that mark a request as workflow building, so the workspace opens before the reply lands. */
const WORKFLOW_INTENT = /\b(workflow|pipeline|flow)\b|תהליך|זרימ|פייפליין/i;
export const looksLikeWorkflowRequest = (text: string) => WORKFLOW_INTENT.test(text);

const lastDraftOp = (messages: { operations?: AIOperation[] }[]) =>
  messages.flatMap((m) => m.operations ?? []).filter((op) => op.type === 'REPLACE_WORKFLOW_DRAFT').at(-1);

/**
 * The authoritative workflow draft of the conversation on screen. It is persisted per conversation, read synchronously
 * when a request is built (so the assistant sees manual edits), and protected against replies that arrive late.
 */
export function useWorkflowWorkspace() {
  const [state, setState] = useReducer(reducer, undefined, initialState);
  const [boundId, setBoundId] = useState<number | null>(null);
  const live = useRef(state);

  useEffect(() => { if (boundId != null) saveWorkspace(boundId, state); }, [boundId, state]);

  /** Dispatching also updates the synchronous copy, so a request built right after an edit reads that edit. */
  const dispatch = useCallback((action: Action) => { live.current = reducer(live.current, action); setState(action); }, []);
  const change = useCallback((update: (nodes: WorkflowNode[]) => WorkflowNode[]) => dispatch({ type: 'nodes', update }), [dispatch]);
  const load = (next: WorkspaceState, id: number | null) => { dispatch({ type: 'load', state: next }); setBoundId(id); };

  return {
    state, dispatch, change,
    reset: () => load(initialState(), null),
    /** Opens a conversation: its stored draft, else the last proposal in its history, else an empty workspace. */
    restore: (id: number, messages: { operations?: AIOperation[] }[]) => {
      const stored = loadWorkspace(id);
      const op = stored ? undefined : lastDraftOp(messages);
      load(stored ?? (op ? reducer(initialState(), { type: 'apply', proposal: proposalOf(op) }) : initialState()), id);
    },
    /** The first reply of a new conversation gives it an id; the draft already on screen becomes that conversation's. */
    bind: (id: number) => setBoundId((current) => current ?? id),
    /** Reads the draft for an outgoing request. Mentioned servers and files join the conversation's references. */
    begin: (text: string, servers: Ref[], files: Ref[]) => {
      if (looksLikeWorkflowRequest(text)) dispatch({ type: 'start' });
      dispatch({ type: 'refs', servers, files });
      dispatch({ type: 'failure', failure: null });
      return { draftSummary: draftContext(live.current), revision: live.current.revision };
    },
    /**
     * Applies an assistant proposal only if the draft is still the one it was based on. If the user edited meanwhile it
     * is offered instead, and a reply for a conversation that is no longer on screen is applied to that one's stored draft.
     */
    receive: (conversationId: number, op: AIOperation, sentRevision: number, current: boolean) => {
      const proposal = proposalOf(op);
      if (current) {
        dispatch(live.current.revision === sentRevision ? { type: 'apply', proposal } : { type: 'pending', proposal });
        return;
      }
      const stored = loadWorkspace(conversationId) ?? initialState();
      if (stored.revision === sentRevision) saveWorkspace(conversationId, reducer(stored, { type: 'apply', proposal }));
    },
  };
}
