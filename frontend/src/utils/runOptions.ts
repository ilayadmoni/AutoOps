import type { RunOptions } from '../types/api';

export const defaultRunOptions = (machineIds: number[] = []): RunOptions => ({
  machineIds, credentialId: null, mode: 'MANUAL', concurrency: 1, failurePolicy: 'STOP_NEW_MACHINES',
});

/** The API expects null rather than 0/undefined for "use each machine's preferred credential". */
export const toRunRequest = (options: RunOptions) => ({ ...options, credentialId: options.credentialId || null });
