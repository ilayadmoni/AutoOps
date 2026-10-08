import { del, get, post, put } from '../lib/apiClient';
import type { Credential } from '../types/api';

export const credentialsService = {
  list: () => get<Credential[]>('/credentials'),
  create: (input: { name: string; username: string; password: string }) => post<Credential>('/credentials', input),
  /** A null password keeps the stored secret. */
  update: (id: number, input: { name: string; username: string; password: string | null }) => put<Credential>('/credentials/' + id, input),
  remove: (id: number) => del('/credentials/' + id),
};
