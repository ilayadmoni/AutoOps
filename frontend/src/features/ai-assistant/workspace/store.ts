import { initialState, type WorkspaceState } from './model';

const key = (conversationId: number) => `autoops.workspace.v1.${conversationId}`;

/** Unfinished drafts, per conversation, in this browser. Never the saved workflow itself; transient state is not kept. */
export function loadWorkspace(conversationId: number): WorkspaceState | null {
  try {
    const raw = localStorage.getItem(key(conversationId));
    return raw ? { ...initialState(), ...(JSON.parse(raw) as Partial<WorkspaceState>), errors: {}, failure: null, pending: null } : null;
  } catch {
    return null;
  }
}

export function saveWorkspace(conversationId: number, state: WorkspaceState) {
  try {
    if (!state.started) localStorage.removeItem(key(conversationId));
    else localStorage.setItem(key(conversationId), JSON.stringify({ ...state, errors: {}, failure: null, pending: null }));
  } catch {
    // storage unavailable or full; the draft still lives in memory
  }
}

export function forgetWorkspace(conversationId: number) {
  try { localStorage.removeItem(key(conversationId)); } catch { /* ignore */ }
}
