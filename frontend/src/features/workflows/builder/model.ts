import type { NodeType, ValidationError, WorkflowNode } from '../../../types/api';

export type Errors = Record<string, Record<string, string>>;

/** Creates a step with the defaults the engine expects, and a key that is free in this draft. */
export function newNode(type: NodeType, existing: WorkflowNode[]): WorkflowNode {
  let i = existing.length + 1;
  while (existing.some((n) => n.key === 's' + i)) i++;
  const base = { key: 's' + i, type, requiresApproval: false, successNext: null, failureNext: null };
  if (type === 'COMMAND') {
    return { ...base, name: 'Run command', commandDefinitionId: null, parameters: {}, runWithSudo: false, timeoutSeconds: 300 };
  }
  if (type === 'FILE_TRANSFER') {
    return { ...base, name: 'Transfer file', storedFileId: null, destinationPath: '/tmp/', overwrite: false, useSudo: false, timeoutSeconds: 300 };
  }
  return { ...base, name: 'Wait until', checkType: 'SERVICE_ACTIVE', target: '', intervalSeconds: 5, timeoutSeconds: 120, parameters: {} };
}

/** Normalizes nodes coming from the API or from an AI proposal into editable state. */
export function normalize(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((n) => ({
    ...n,
    type: (n.type as string) === 'FILE' ? 'FILE_TRANSFER' : (n.type as string) === 'WAIT' ? 'WAIT_UNTIL' : n.type,
    parameters: n.parameters ?? {},
    timeoutSeconds: n.timeoutSeconds ?? (n.type === 'WAIT_UNTIL' ? 120 : 300),
    intervalSeconds: n.type === 'WAIT_UNTIL' ? n.intervalSeconds ?? 5 : n.intervalSeconds,
  }));
}

export function groupErrors(list: ValidationError[]): Errors {
  const out: Errors = {};
  for (const e of list) {
    const k = e.nodeKey ?? '_';
    out[k] = { ...(out[k] ?? {}), [e.field]: e.message };
  }
  return out;
}

export function fromFieldErrors(fe: Record<string, string>): Errors {
  const out: Errors = {};
  for (const [path, msg] of Object.entries(fe)) {
    const m = path.match(/^nodes\.([^.]+)\.(.+)$/);
    const k = m ? m[1] : '_';
    const f = m ? m[2] : path;
    out[k] = { ...(out[k] ?? {}), [f]: msg };
  }
  return out;
}
