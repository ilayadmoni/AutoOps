import { get } from '../../services/client';
import type { Machine, RunOptions } from '../../types/api';

export const machinesQuery = { queryKey: ['machines'], queryFn: () => get<Machine[]>('/machines') };
export const defaultRunOptions = (machineIds: number[] = []): RunOptions => ({
  machineIds, credentialId: null, mode: 'AUTOMATIC', concurrency: 1, failurePolicy: 'STOP_NEW_MACHINES',
});
