/**
 * Every TanStack Query key in one place. Keys are hierarchical, so invalidating a prefix
 * (e.g. `queryKeys.commands.all`) also refreshes the filtered lists below it.
 */
export const queryKeys = {
  machines: ['machines'] as const,
  credentials: ['credentials'] as const,
  files: ['files'] as const,
  commands: {
    all: ['commands'] as const,
    approved: ['commands', 'approved'] as const,
    search: (q: string, category: string, risk: string) => ['commands', 'search', q, category, risk] as const,
  },
  workflows: {
    all: ['workflows'] as const,
    detail: (id: number | null) => ['workflow', id] as const,
  },
  executions: {
    list: (allUsers: boolean, page: number) => ['executions', allUsers, page] as const,
    detail: (id: number) => ['execution', id] as const,
  },
  approvals: {
    all: ['approvals'] as const,
    pending: (allUsers: boolean) => ['approvals', 'pending', allUsers] as const,
  },
  ai: {
    status: ['ai', 'status'] as const,
    conversations: ['ai', 'conversations'] as const,
  },
  admin: {
    summary: ['admin', 'summary'] as const,
    embeddings: ['admin', 'embeddings'] as const,
    users: ['admin', 'users'] as const,
    commands: {
      all: ['admin', 'commands'] as const,
      byStatus: (status: string) => ['admin', 'commands', status] as const,
    },
    datasets: ['admin', 'datasets'] as const,
    dataset: (id: number) => ['admin', 'dataset', id] as const,
    audit: (page: number, action: string, entityType: string) => ['admin', 'audit', page, action, entityType] as const,
  },
};
