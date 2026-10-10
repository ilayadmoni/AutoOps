import type { WorkflowDraft } from '../../types/api';

/** Hand-off of AI-proposed drafts to the builder. Local only; the assistant's own draft lives in its workspace store. */
const AI_DRAFT = 'autoops.workflow.aiDraft';

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
