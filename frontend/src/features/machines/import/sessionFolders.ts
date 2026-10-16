import type { ImportRow } from './types';

export interface SessionFolder {
  path: string; name: string; rows: ImportRow[]; children: SessionFolder[]; indices: number[]; eligibleIndices: number[];
}

/** Build logical folders only; root sessions have their own Unfiled disclosure. */
export function sessionFolders(rows: ImportRow[]) {
  const roots: SessionFolder[] = [];
  const folders = new Map<string, SessionFolder>();
  function ensure(path: string): SessionFolder {
    const existing = folders.get(path);
    if (existing) return existing;
    const at = path.lastIndexOf('/');
    const node: SessionFolder = { path, name: at < 0 ? path : path.slice(at + 1), rows: [], children: [], indices: [], eligibleIndices: [] };
    folders.set(path, node);
    if (at < 0) roots.push(node); else ensure(path.slice(0, at)).children.push(node);
    return node;
  }
  for (const row of rows) {
    const folder = ensure(row.folderPath);
    folder.rows.push(row);
    folder.indices.push(row.index);
    if (!row.skipReason) folder.eligibleIndices.push(row.index);
    let path = row.folderPath;
    while (path.includes('/')) {
      path = path.slice(0, path.lastIndexOf('/'));
      ensure(path).indices.push(row.index);
      if (!row.skipReason) ensure(path).eligibleIndices.push(row.index);
    }
  }
  return roots;
}

/** Reveal all collapsed ancestors before the browser focuses an invalid credential input. */
export function revealInvalidCredential(target: EventTarget) {
  if (!(target instanceof HTMLElement)) return;
  let ancestor = target.parentElement;
  while (ancestor) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    ancestor = ancestor.parentElement;
  }
}
