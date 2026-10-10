import type { AIOperation, MissingField, WorkflowNode } from '../../../types/api';
import { normalize, type Errors } from '../../workflows/builder/model';

export type Ref = { id: number; name: string };
export type Failure = { message: string; code?: string };
export type Proposal = { name: string; description: string; nodes: WorkflowNode[]; missing: MissingField[] };

/** The one authoritative workflow draft of a conversation. Saved workflows live elsewhere; this is the unfinished copy. */
export type WorkspaceState = {
  /** The user has started building, so the workspace stays open even before any step exists. */
  started: boolean;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  /** Information the assistant says is still missing. */
  missing: MissingField[];
  /** Validation errors from the last save or validate, by step key. */
  errors: Errors;
  revision: number;
  savedRevision: number | null;
  workflowId: number | null;
  version: number | null;
  servers: Ref[];
  files: Ref[];
  failure: Failure | null;
  /** An assistant proposal that arrived after newer edits; it is offered, never applied silently. */
  pending: Proposal | null;
};

export const initialState = (): WorkspaceState => ({
  started: false, name: '', description: '', nodes: [], missing: [], errors: {}, revision: 0, savedRevision: null,
  workflowId: null, version: null, servers: [], files: [], failure: null, pending: null,
});

export type Action =
  | { type: 'load'; state: WorkspaceState }
  | { type: 'start' }
  | { type: 'refs'; servers: Ref[]; files: Ref[] }
  | { type: 'meta'; name?: string; description?: string }
  | { type: 'nodes'; update: (nodes: WorkflowNode[]) => WorkflowNode[] }
  | { type: 'apply'; proposal: Proposal }
  | { type: 'pending'; proposal: Proposal | null }
  | { type: 'errors'; errors: Errors }
  | { type: 'saved'; id: number; version: number }
  | { type: 'failure'; failure: Failure | null };

const union = (a: Ref[], b: Ref[]) => [...new Map([...a, ...b].map((r) => [r.id, r])).values()];

export function reducer(s: WorkspaceState, a: Action): WorkspaceState {
  switch (a.type) {
    case 'load': return a.state;
    case 'start': return s.started ? s : { ...s, started: true };
    case 'refs': return { ...s, servers: union(s.servers, a.servers), files: union(s.files, a.files) };
    case 'meta': return { ...s, name: a.name ?? s.name, description: a.description ?? s.description, revision: s.revision + 1 };
    case 'nodes': {
      const nodes = a.update(s.nodes);
      const keys = new Set(nodes.map((n) => n.key));
      return { ...s, nodes, errors: {}, revision: s.revision + 1, missing: s.missing.filter((m) => !m.nodeKey || keys.has(m.nodeKey)) };
    }
    case 'apply': return { ...s, ...a.proposal, started: true, errors: {}, failure: null, pending: null, revision: s.revision + 1 };
    case 'pending': return { ...s, pending: a.proposal };
    case 'errors': return { ...s, errors: a.errors };
    case 'saved': return { ...s, errors: {}, workflowId: a.id, version: a.version, savedRevision: s.revision };
    case 'failure': return { ...s, failure: a.failure };
  }
}

export const isDirty = (s: WorkspaceState) => s.savedRevision !== s.revision;

export function proposalOf(op: AIOperation): Proposal {
  const p = op.payload as { name?: string; description?: string; nodes?: WorkflowNode[] };
  return { name: p.name ?? '', description: p.description ?? '', nodes: normalize(p.nodes ?? []), missing: op.missingFields ?? [] };
}

/** What the assistant receives with each request: the draft as the user currently sees it, manual edits included. */
export function draftContext(s: WorkspaceState): string | null {
  if (!s.started) return null;
  const { name, description, nodes, missing, servers, files, workflowId } = s;
  return JSON.stringify({ name, description, nodes, missing, selectedServers: servers, selectedFiles: files, savedWorkflowId: workflowId });
}
