import { api } from '../../services/client';
import type { StoredFile } from '../../types/api';

export interface FolderEntry { path: string; size: number; checksum: string; executable: boolean }
export interface FolderSelection { name: string; files: File[]; paths: string[] }
export interface FolderLimits { maxFiles: number; maxBytes: number }

export function selectFolder(files: File[]): FolderSelection {
  const name = files[0]?.webkitRelativePath.split('/')[0];
  if (!name || files.some((f) => !f.webkitRelativePath.startsWith(name + '/'))) throw new Error('folders.invalid');
  const paths = files.map((f) => f.webkitRelativePath.slice(name.length + 1));
  const all = new Set(paths);
  if (all.size !== paths.length || paths.some((path) => {
    const parts = path.split('/');
    return /[\\\x00-\x1f\x7f]/.test(path) || /^[A-Za-z]:/.test(path) || new TextEncoder().encode(path).length > 1024
      || parts.some((part, i) => !part || part === '.' || part === '..' || i < parts.length - 1 && all.has(parts.slice(0, i + 1).join('/')));
  })) throw new Error('folders.invalid');
  return { name, files, paths };
}

export function uploadFolder(selection: FolderSelection, executablePaths: string[]) {
  const body = new FormData();
  body.append('manifest', new Blob([JSON.stringify({ name: selection.name, paths: selection.paths, executablePaths })], { type: 'application/json' }));
  selection.files.forEach((file) => body.append('files', file, file.name));
  return api<StoredFile>('/files/folders', { method: 'POST', body });
}
