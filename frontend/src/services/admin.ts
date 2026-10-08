import { del, get, patch, post, upload } from '../lib/apiClient';
import type { AdminSummary, AuditEvent, Command, DatasetView, EmbeddingsStatus, Page, Role, UserView } from '../types/api';

export const adminService = {
  summary: () => get<AdminSummary>('/admin/summary'),
  embeddings: () => get<EmbeddingsStatus>('/admin/embeddings'),
  reindexEmbeddings: () => post<{ indexed: number }>('/admin/embeddings/reindex'),
  cleanupFiles: () => post<{ purged: number }>('/admin/files/cleanup'),

  users: () => get<UserView[]>('/admin/users'),
  createUser: (input: { username: string; password: string; role: Role }) => post<UserView>('/admin/users', input),
  setUserStatus: (id: number, status: UserView['status']) => patch<UserView>(`/admin/users/${id}/status`, { status }),
  setUserRole: (id: number, role: Role) => patch<UserView>(`/admin/users/${id}/role`, { role }),
  resetPassword: (id: number, password: string) => post<void>(`/admin/users/${id}/reset-password`, { password }),
  deleteUser: (id: number) => del('/admin/users/' + id),

  commands: (status: string) => get<Command[]>('/admin/commands?status=' + status),
  approveCommand: (id: number) => post<Command>(`/admin/commands/${id}/approve`),
  rejectCommand: (id: number, reason: string) => post<Command>(`/admin/commands/${id}/reject`, { reason }),

  datasets: () => get<DatasetView[]>('/admin/datasets'),
  dataset: (id: number) => get<DatasetView>('/admin/datasets/' + id),
  uploadDataset: (file: File) => upload<DatasetView>('/admin/datasets/upload', file),
  confirmDataset: (id: number, approveUpTo: string) => post<DatasetView>(`/admin/datasets/${id}/confirm`, { approveUpTo }),
  rejectDataset: (id: number, reason: string) => post<DatasetView>(`/admin/datasets/${id}/reject`, { reason }),

  audit: (page: number, action: string, entityType: string) =>
    get<Page<AuditEvent>>(`/admin/audit?page=${page}&size=50&action=${encodeURIComponent(action)}&entityType=${encodeURIComponent(entityType)}`),
};
