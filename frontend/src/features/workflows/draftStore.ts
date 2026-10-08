import type { WorkflowDraft } from '../../types/api';
import { readJson, writeJson } from '../../utils/storage';

/** Hand-off of AI-proposed drafts to the builder, and of the builder's current draft to the assistant. Local only. */
const AI_DRAFT = 'autoops.workflow.aiDraft';
const CURRENT = 'autoops.workflow.current';

const read = (key: string) => readJson<WorkflowDraft>(key, 'session');
const write = (key: string, draft: WorkflowDraft | null) => writeJson(key, draft, 'session');

export const setAiDraft = (d: WorkflowDraft) => write(AI_DRAFT, d);
export const takeAiDraft = () => {
  const d = read(AI_DRAFT);
  write(AI_DRAFT, null);
  return d;
};
export const setCurrentDraft = (d: WorkflowDraft | null) => write(CURRENT, d);
export const getCurrentDraft = () => read(CURRENT);
