import { get, post } from '../lib/apiClient';
import type { ApprovalView } from '../types/api';

export const approvalsService = {
  pending: (allUsers = false) => get<ApprovalView[]>('/approvals/pending' + (allUsers ? '?all=true' : '')),
  decide: (id: number, decision: { approve: boolean; highRiskAcknowledged: boolean; comment: string | null }) =>
    post<ApprovalView>(`/approvals/${id}/decision`, decision),
};
