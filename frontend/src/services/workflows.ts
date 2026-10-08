import { del, get, post, put } from '../lib/apiClient';
import type { ExecutionDetail, RunOptions, ValidationResult, WorkflowDraft, WorkflowSummary, WorkflowView } from '../types/api';

export const workflowsService = {
  list: () => get<WorkflowSummary[]>('/workflows'),
  get: (id: number) => get<WorkflowView>('/workflows/' + id),
  create: (draft: WorkflowDraft) => post<WorkflowView>('/workflows', draft),
  update: (id: number, draft: WorkflowDraft) => put<WorkflowView>('/workflows/' + id, draft),
  remove: (id: number) => del('/workflows/' + id),
  duplicate: (id: number) => post<WorkflowView>(`/workflows/${id}/duplicate`),
  validate: (draft: WorkflowDraft) => post<ValidationResult>('/workflows/validate', draft),
  run: (id: number, options: RunOptions) => post<ExecutionDetail>(`/workflows/${id}/run`, options),
};
