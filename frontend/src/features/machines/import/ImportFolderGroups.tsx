import { useMemo } from 'react';
import { ChevronRight, Folder } from 'lucide-react';
import { useI18n } from '../../../app/providers/I18nProvider';
import { Checkbox } from '../../../components/ui';
import ImportSessionRow from './ImportSessionRow';
import { sessionFolders, type SessionFolder } from './sessionFolders';
import type { CredentialDraft, ImportRow } from './types';

interface Props {
  rows: ImportRow[]; selected: Set<number>; drafts: Record<number, CredentialDraft>;
  onToggle: (index: number) => void; onCredential: (index: number, value?: CredentialDraft) => void;
  onSelectFolder: (indices: number[], checked: boolean) => void;
}

function FolderGroup({ node, ...props }: Omit<Props, 'rows'> & { node: SessionFolder }) {
  const { t } = useI18n();
  const selected = node.indices.filter(index => props.selected.has(index)).length;
  const name = node.name || t('machineFolders.root');
  const eligibleCount = node.eligibleIndices.length;
  return <div className="importFolderGroup">
    <Checkbox className="importFolderSelect" name={'folder-selection-' + node.path}
      aria-label={t('machineImport.selectFolder', { name: node.path || name })}
      checked={eligibleCount > 0 && selected === eligibleCount} indeterminate={selected > 0 && selected < eligibleCount}
      disabled={!eligibleCount} onChange={e => props.onSelectFolder(node.eligibleIndices, e.target.checked)} />
    <details className="importFolder" data-folder-path={node.path}>
    <summary>
      <ChevronRight size={16} className="importFolderChevron" aria-hidden="true" />
      <Folder size={18} aria-hidden="true" />
      <span className="importFolderName">{name}</span>
      <small className="muted">{t('machineImport.folderCount', { selected, total: node.indices.length, n: node.indices.length })}</small>
    </summary>
    <div className="importFolderContents">
      {!!node.rows.length && <ul className="importSessions">{node.rows.map(row => <ImportSessionRow key={row.index} row={row}
        selected={props.selected.has(row.index)} draft={props.drafts[row.index]} onToggle={() => props.onToggle(row.index)}
        onCredential={value => props.onCredential(row.index, value)} />)}</ul>}
      {node.children.map(child => <FolderGroup key={child.path} node={child} {...props} />)}
    </div>
    </details>
  </div>;
}

export default function ImportFolderGroups({ rows, ...props }: Props) {
  const folders = useMemo(() => sessionFolders(rows), [rows]);
  return <div className="importFolderGroups">{folders.map(node => <FolderGroup key={node.path} node={node} {...props} />)}</div>;
}
