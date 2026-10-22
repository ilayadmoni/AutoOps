import type { Machine, MachineFolder } from '../../types/api';

export interface MachineBranch {
  id: number | null; name: string; path: string; machines: Machine[]; children: MachineBranch[]; ids: number[];
}

/** Selection always includes the complete subtree, even while search hides some members. */
export function machineTree(machines: Machine[], folders: MachineFolder[]): MachineBranch[] {
  const root: MachineBranch = { id: null, name: '', path: '', machines: [], children: [], ids: [] };
  const nodes = new Map(folders.map(f => [f.id, { ...f, machines: [], children: [], ids: [] } as MachineBranch]));
  for (const folder of folders) {
    const parent = folder.parentId == null ? root : nodes.get(folder.parentId) ?? root;
    parent.children.push(nodes.get(folder.id)!);
  }
  for (const machine of machines) (nodes.get(machine.folderId ?? -1) ?? root).machines.push(machine);
  function collect(node: MachineBranch): number[] {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.ids = [...node.machines.map(m => m.id), ...node.children.flatMap(collect)];
    return node.ids;
  }
  collect(root);
  return [...root.children, ...(root.machines.length ? [{ ...root, children: [], ids: root.machines.map(m => m.id) }] : [])];
}

export function searchMachineTree(nodes: MachineBranch[], query: string): MachineBranch[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return nodes;
  return nodes.flatMap(node => {
    if (node.path.toLocaleLowerCase().includes(needle)) return [node];
    const machines = node.machines.filter(m => [m.name, m.hostname, m.operatingSystem, m.sshPort]
      .some(v => String(v ?? '').toLocaleLowerCase().includes(needle)));
    const children = searchMachineTree(node.children, needle);
    return machines.length || children.length ? [{ ...node, machines, children }] : [];
  });
}

export function toggleMachineIds(current: number[], ids: number[], checked: boolean): number[] {
  const next = new Set(current);
  for (const id of ids) { if (checked) next.add(id); else next.delete(id); }
  return [...next];
}
