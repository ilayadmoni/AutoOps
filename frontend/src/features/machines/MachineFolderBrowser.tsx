import { ChevronRight, Folder, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../app/providers/I18nProvider';
import type { Machine, MachineFolder } from '../../types/api';
import { Checkbox, IconButton } from '../../components/ui';
import type { useMachineSelection } from './useMachineSelection';

export function folderLocation(id: number | null) { return id === null ? '?' : '?folder=' + id; }

export function folderDescendants(folder: MachineFolder, folders: MachineFolder[]) {
  return new Set(folders.filter(f => f.id === folder.id || f.path.startsWith(folder.path + '/')).map(f => f.id));
}

export function MachineBreadcrumbs({ current, folders, onNavigate }: {
  current?: MachineFolder; folders: MachineFolder[]; onNavigate: () => void;
}) {
  const { t } = useI18n();
  const ancestors = current ? folders.filter(f => f.id === current.id || current.path.startsWith(f.path + '/'))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length) : [];
  return <nav className="machineBreadcrumbs" aria-label={t('machineFolders.navigation')}>
    <ol>
      <li>{current ? <Link to={folderLocation(null)} onClick={onNavigate}>{t('machineFolders.all')}</Link>
        : <span aria-current="page">{t('machineFolders.all')}</span>}</li>
      {ancestors.map(f => <li key={f.id}>
        <ChevronRight size={14} aria-hidden="true" />
        {f.id === current?.id ? <span aria-current="page">{f.name}</span>
          : <Link to={folderLocation(f.id)} onClick={onNavigate}>{f.name}</Link>}
      </li>)}
    </ol>
  </nav>;
}

export function MachineFolderCard({ folder, folders, machines, onNavigate, onDelete, selection, favorite }: {
  folder: MachineFolder; folders: MachineFolder[]; machines: Machine[]; onNavigate: () => void;
  onDelete: () => void;
  favorite?: ReactNode;
  selection: Pick<ReturnType<typeof useMachineSelection>, 'ids' | 'busy' | 'active' | 'selectVisible'>;
}) {
  const { t } = useI18n();
  const descendantIds = folderDescendants(folder, folders);
  const members = machines.filter(m => m.folderId != null && descendantIds.has(m.folderId));
  const count = members.length;
  const selectedCount = members.filter(machine => selection.ids.has(machine.id)).length;
  const children = folders.filter(f => f.parentId === folder.id).length;
  return <div className={'machineFolderItem' + (selection.active ? ' selecting' : '') + (favorite ? ' favoritable' : '')}>
    {favorite && <span className="machineFolderFavorite">{favorite}</span>}
    <IconButton className="machineFolderDelete" danger label={t('machineFolders.delete', { name: folder.name })}
      disabled={selection.busy} onClick={onDelete}><Trash2 size={16} /></IconButton>
    {selection.active && <Checkbox className="machineFolderSelect" aria-label={t('machinesBulk.selectFolder', { name: folder.name })}
      checked={count > 0 && selectedCount === count} indeterminate={selectedCount > 0 && selectedCount < count}
      disabled={selection.busy || count === 0} onChange={event => selection.selectVisible(members, event.target.checked)} />}
    <Link className="card interactive machineFolderCard" to={folderLocation(folder.id)} onClick={onNavigate}>
    <Folder size={32} aria-hidden="true" />
    <h2 className="cardTitle">{folder.name}</h2>
    <div className="muted">
      <span>{t('machineFolders.machineCount', { n: count })}</span>
      {!!children && <span> · {t('machineFolders.folderCount', { n: children })}</span>}
    </div>
    </Link>
  </div>;
}
