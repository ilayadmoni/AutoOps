import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Folder, History } from 'lucide-react';
import { get } from '../../services/client';
import { useI18n } from '../../app/providers/I18nProvider';
import { Checkbox, ErrorAlert, Loading, SearchInput } from '../../components/ui';
import type { Machine } from '../../types/api';
import { useMachineFolders } from '../machines/useMachineFolders';
import { machinesQuery } from './runOptions';
import { machineTree, searchMachineTree, toggleMachineIds, type MachineBranch } from './machineTree';
import '../../assets/styles/machine-folder-picker.css';

interface Props {
  selected: number[]; onChange: (ids: number[]) => void; historyWorkflowId?: number; previouslyRun?: ReadonlySet<number>;
}

function MachineChoice({ machine, selected, onChange, previouslyRun }: Props & { machine: Machine }) {
  const { t } = useI18n();
  return <Checkbox boxed checked={selected.includes(machine.id)}
    onChange={e => onChange(toggleMachineIds(selected, [machine.id], e.target.checked))}
    label={<span className="checkRow">
      <span className="truncate" dir="auto">{machine.name}</span>
      <small className="muted mono" dir="ltr">{machine.hostname}:{machine.sshPort}</small>
      {machine.trustStatus !== 'TRUSTED' && <span className="badge warn">{t('status.' + machine.trustStatus)}</span>}
      {previouslyRun?.has(machine.id) && <span className="badge"><History size={12} aria-hidden="true" />{t('fleet.ranBefore')}</span>}
    </span>} />;
}

function FolderChoice({ node, searching, ...props }: Props & { node: MachineBranch; searching: boolean }) {
  const { t } = useI18n();
  const count = node.ids.filter(id => props.selected.includes(id)).length;
  const name = node.id == null ? t('machineFolders.root') : node.name;
  return <div className="runFolderGroup">
    <Checkbox className="runFolderSelect" aria-label={t('fleet.selectFolder', { name: node.path || name })}
      checked={node.ids.length > 0 && count === node.ids.length} indeterminate={count > 0 && count < node.ids.length}
      disabled={!node.ids.length} onChange={e => props.onChange(toggleMachineIds(props.selected, node.ids, e.target.checked))} />
    <details className="runFolder" open={searching || undefined}>
      <summary><ChevronRight size={16} className="runFolderChevron" aria-hidden="true" /><Folder size={17} aria-hidden="true" />
        <span className="runFolderName" dir="auto">{name}</span>
        <small className="muted">{t('fleet.folderSelected', { selected: count, total: node.ids.length })}</small>
      </summary>
      <div className="runFolderContents">
        {node.children.map(child => <FolderChoice key={child.id} node={child} searching={searching} {...props} />)}
        {node.machines.map(machine => <MachineChoice key={machine.id} machine={machine} {...props} />)}
      </div>
    </details>
  </div>;
}

export default function MachineFolderPicker(props: Props) {
  const { t } = useI18n();
  const machines = useQuery(machinesQuery);
  const folders = useMachineFolders();
  const history = useQuery({ queryKey: ['workflow-machines', props.historyWorkflowId],
    queryFn: () => get<number[]>(`/workflows/${props.historyWorkflowId}/machine-history`), enabled: props.historyWorkflowId != null,
    staleTime: 0, refetchOnMount: 'always' });
  const previouslyRun = useMemo(() => new Set(history.data ?? []), [history.data]);
  const [query, setQuery] = useState('');
  const tree = useMemo(() => machineTree(machines.data ?? [], folders.data ?? []), [machines.data, folders.data]);
  const visible = searchMachineTree(tree, query);
  return <div className="stack tight">
    <ErrorAlert error={history.error} onRetry={() => history.refetch()} />
    {props.historyWorkflowId != null && history.isPending && <small className="muted" role="status">{t('fleet.historyLoading')}</small>}
    <SearchInput aria-label={t('machines.searchPlaceholder')} placeholder={t('machines.searchPlaceholder')}
      value={query} onChange={e => setQuery(e.target.value)} />
    {machines.isPending || folders.isPending ? <Loading /> : machines.error || folders.error
      ? <ErrorAlert error={machines.error || folders.error} onRetry={() => { void machines.refetch(); void folders.refetch(); }} />
      : <div className="checkList runFolderList">
        {!machines.data?.length ? <span className="muted">{t('run.noMachines')}</span>
          : !visible.length ? <span className="muted">{t('machines.noMatch')}</span>
            : visible.map(node => <FolderChoice key={node.id ?? 'root'} node={node} searching={!!query.trim()} {...props} previouslyRun={previouslyRun} />)}
      </div>}
    <small className="muted">{t('fleet.selectionHint', { n: props.selected.length })}</small>
  </div>;
}
