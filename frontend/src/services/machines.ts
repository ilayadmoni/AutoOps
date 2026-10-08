import { del, get, post, put } from '../lib/apiClient';
import type { Discovery, Machine, MachineTest } from '../types/api';

export interface MachineInput {
  name: string;
  hostname: string;
  sshPort: number;
  operatingSystem: string;
  osVersion: string;
  preferredCredentialId: number | null;
}

export const machinesService = {
  list: () => get<Machine[]>('/machines'),
  create: (input: MachineInput) => post<Machine>('/machines', input),
  update: (id: number, input: MachineInput) => put<Machine>('/machines/' + id, input),
  remove: (id: number) => del('/machines/' + id),
  discoverHostKey: (id: number) => post<Discovery>(`/machines/${id}/ssh-trust/discover`),
  confirmHostKey: (id: number, expectedFingerprint: string) => post<Machine>(`/machines/${id}/ssh-trust/confirm`, { expectedFingerprint }),
  revokeTrust: (id: number) => del(`/machines/${id}/ssh-trust`),
  test: (id: number, credentialId: number | null) => post<MachineTest>(`/machines/${id}/test`, { credentialId, checkSudo: true }),
};
