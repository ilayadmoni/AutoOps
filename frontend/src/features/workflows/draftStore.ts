import type { WorkflowDraft } from '../../types/api';

/** Hand-off of AI-proposed drafts to the builder, and of the builder's current draft to the assistant. Local only. */
const AI_DRAFT = 'autoops.workflow.aiDraft';
const CURRENT = 'autoops.workflow.current';

function read(key: string): WorkflowDraft | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as WorkflowDraft) : null;
  } catch {
    return null;
  }
}

function write(key: string, draft: WorkflowDraft | null) {
  try {
    if (draft) sessionStorage.setItem(key, JSON.stringify(draft));
    else sessionStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
}

export const setAiDraft = (d: WorkflowDraft) => write(AI_DRAFT, d);
export const takeAiDraft = () => {
  const d = read(AI_DRAFT);
  write(AI_DRAFT, null);
  return d;
};
export const setCurrentDraft = (d: WorkflowDraft | null) => write(CURRENT, d);
export const getCurrentDraft = () => read(CURRENT);
