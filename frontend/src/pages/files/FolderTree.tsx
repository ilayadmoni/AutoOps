import { FileText, Folder, Trash2 } from 'lucide-react';
import { Checkbox, IconButton } from '../../components/ui';
import { useI18n } from '../../app/providers/I18nProvider';
import type { FolderEntry } from './folderPackage';
import './folderPackages.css';

interface Tree { dirs: Map<string, Tree>; files: FolderEntry[] }
export default function FolderTree({ entries, executable, onToggle, onDeleteFolder }: {
  entries: FolderEntry[]; executable?: Set<string>; onToggle?: (path: string, checked: boolean) => void;
  onDeleteFolder?: (path: string) => void;
}) {
  const { t } = useI18n();
  const tree: Tree = { dirs: new Map(), files: [] };
  for (const entry of entries) {
    let branch = tree;
    for (const part of entry.path.split('/').slice(0, -1)) {
      if (!branch.dirs.has(part)) branch.dirs.set(part, { dirs: new Map(), files: [] });
      branch = branch.dirs.get(part)!;
    }
    branch.files.push(entry);
  }
  const render = (branch: Tree, prefix = '', depth = 0) => <ul className="folderTreeList">
    {[...branch.dirs].sort(([a], [b]) => a.localeCompare(b)).map(([name, child]) => {
      const path = prefix ? prefix + '/' + name : name;
      return <li className="folderTreeDirectory" key={name}>
        <details open={depth < 2}><summary><Folder size={14} /> <bdi>{name}</bdi></summary>{render(child, path, depth + 1)}</details>
        {onDeleteFolder && <IconButton className="folderTreeDelete" danger label={t('folders.deleteSubfolder', { name: path })}
          onClick={() => onDeleteFolder(path)}><Trash2 size={14} /></IconButton>}
      </li>;
    })}
    {branch.files.map((entry) => <li className="folderTreeFile" key={entry.path}>
      <FileText size={14} /><bdi title={entry.path}>{entry.path.split('/').at(-1)}</bdi>
      {onToggle ? <Checkbox label={t('folders.executable')} aria-label={`${t('folders.executable')}: ${entry.path}`} checked={!!executable?.has(entry.path)}
        onChange={(e) => onToggle(entry.path, e.target.checked)} /> : entry.executable && <small>{t('folders.executable')}</small>}
    </li>)}
  </ul>;
  return <div className="folderTree" dir="ltr">{render(tree)}</div>;
}
