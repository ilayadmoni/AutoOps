import { get, post, streamEvents } from '../lib/apiClient';
import type { ExecutionDetail, ExecutionSummary, Page, RunOptions } from '../types/api';

export interface CommandRunRequest extends RunOptions {
  commandDefinitionId: number;
  parameters: Record<string, string>;
  runWithSudo: boolean;
}

export const executionsService = {
  list: (page: number, allUsers: boolean) =>
    get<Page<ExecutionSummary>>((allUsers ? '/admin/executions' : '/executions') + `?page=${page}&size=20`),
  get: (id: number) => get<ExecutionDetail>('/executions/' + id),
  runCommand: (request: CommandRunRequest) => post<ExecutionDetail>('/executions/commands', request),
  stop: (id: number) => post<ExecutionDetail>(`/executions/${id}/stop`),
  retryStep: (stepId: number, highRiskAcknowledged: boolean) =>
    post<ExecutionDetail>(`/executions/steps/${stepId}/retry`, { highRiskAcknowledged }),
  /** Live events; returns a function that closes the stream. */
  stream: (id: number, onEvent: (type: string, data: unknown) => void, onClose: () => void) =>
    streamEvents(`/executions/${id}/events`, onEvent, onClose),
};
