import { useCallback, useState } from 'react';
import type { NodeType, WorkflowNode } from '../../../types/api';
import type { Branch } from '../../../components/ui/flow';
import { newNode } from './model';

/**
 * Step editing shared by the standalone builder and the assistant's workspace: add, edit, wire and delete steps.
 * The owner supplies its current `nodes` and `change`, which applies a transformation to its own list of steps.
 */
export function useNodeEditing(nodes: WorkflowNode[], change: (update: (nodes: WorkflowNode[]) => WorkflowNode[]) => void) {
  const [selected, setSelected] = useState<string | null>(null);

  const update = useCallback((key: string, patch: Partial<WorkflowNode>) => {
    change((list) => list.map((n) => (n.key === key ? { ...n, ...patch } : n)));
  }, [change]);

  const add = useCallback((type: NodeType) => {
    const node = newNode(type, nodes);
    change((list) => {
      const last = list[list.length - 1];
      const linked = last && !last.successNext ? list.map((n) => (n.key === last.key ? { ...n, successNext: node.key } : n)) : list;
      return [...linked, node];
    });
    setSelected(node.key);
  }, [change, nodes]);

  const remove = useCallback((key: string) => {
    setSelected((current) => (current === key ? null : current));
    change((list) => list.filter((n) => n.key !== key).map((n) => ({
      ...n,
      successNext: n.successNext === key ? null : n.successNext,
      failureNext: n.failureNext === key ? null : n.failureNext,
    })));
  }, [change]);

  /** n8n-style "+" on an output: the new step arrives already wired to that branch. */
  const addAfter = useCallback((source: string, branch: Branch, type: NodeType) => {
    const node = newNode(type, nodes);
    change((list) => [...list.map((n) => (n.key === source ? { ...n, [branch === 'success' ? 'successNext' : 'failureNext']: node.key } : n)), node]);
    setSelected(node.key);
  }, [change, nodes]);

  const connect = useCallback((source: string, branch: Branch, target: string) => {
    update(source, branch === 'success' ? { successNext: target } : { failureNext: target });
  }, [update]);

  const disconnect = useCallback((source: string, branch: Branch) => {
    update(source, branch === 'success' ? { successNext: null } : { failureNext: null });
  }, [update]);

  return { selected, setSelected, update, add, remove, addAfter, connect, disconnect };
}
