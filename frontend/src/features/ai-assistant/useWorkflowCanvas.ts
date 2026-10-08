import { useEffect, useMemo, useState } from 'react';
import type { AIOperation, MissingField, WorkflowNode } from '../../shared/api/types';
import type { Msg } from './ChatMessage';

export type CanvasDraft = {
  /** Index of the message whose proposal is on the canvas; identifies it for "shown on canvas". */
  messageIndex: number;
  op: AIOperation;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  missing: MissingField[];
};

/** Words that mark a request as workflow building, so the canvas can open before the reply lands. */
const WORKFLOW_INTENT = /\b(workflow|pipeline|flow)\b|תהליך|זרימ|פייפליין/i;
export const looksLikeWorkflowRequest = (text: string) => WORKFLOW_INTENT.test(text);

function toDraft(op: AIOperation, messageIndex: number): CanvasDraft {
  const p = op.payload as { name?: string; description?: string; nodes?: WorkflowNode[] };
  return { messageIndex, op, name: p.name ?? '', description: p.description ?? '', nodes: p.nodes ?? [], missing: op.missingFields ?? [] };
}

/**
 * Which workflow proposal the split canvas shows. By default it follows the newest proposal in
 * the thread, so each revision the assistant makes replaces the picture; `show` pins an older
 * one, and `close` hides the canvas until the next proposal arrives.
 */
export function useWorkflowCanvas(messages: Msg[], pendingText: string | null) {
  const [pinned, setPinned] = useState<number | null>(null);
  const [closedAt, setClosedAt] = useState<number | null>(null);

  const drafts = useMemo(() => {
    const out: CanvasDraft[] = [];
    messages.forEach((m, i) => m.operations?.forEach((op) => {
      if (op.type === 'REPLACE_WORKFLOW_DRAFT') out.push(toDraft(op, i));
    }));
    return out;
  }, [messages]);

  const latest = drafts[drafts.length - 1] ?? null;
  // A new proposal supersedes any pin or close the user made on an earlier one.
  useEffect(() => {
    setPinned(null);
  }, [latest?.messageIndex]);

  const draft = (pinned != null ? drafts.find((d) => d.messageIndex === pinned) : null) ?? latest;
  const closed = draft != null && closedAt === draft.messageIndex;
  const building = pendingText != null && (looksLikeWorkflowRequest(pendingText) || (draft != null && !closed));

  return {
    draft: closed ? null : draft,
    hasDraft: draft != null,
    building,
    open: (!closed && draft != null) || building,
    show: (messageIndex: number) => { setPinned(messageIndex); setClosedAt(null); },
    close: () => draft && setClosedAt(draft.messageIndex),
    reopen: () => setClosedAt(null),
    reset: () => { setPinned(null); setClosedAt(null); },
  };
}
