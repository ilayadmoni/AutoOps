import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Upload } from 'lucide-react';
import { del } from '../../services/client';
import type { Machine } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import {
  Button, ConfirmDialog, EmptyState, ErrorAlert, errorMessage, Fab, Loading, NoMatches, PageHeader, SearchToolbar, useCollectionSearch,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { machinesQuery } from '../../features/executions/RunOptionsForm';
import RunCommandModal from '../../features/commands/RunCommandModal';
import MachineForm from '../../features/machines/MachineForm';
import { TrustDialog } from '../../features/machines/MachineTrust';
import MachineImportDialog from '../../features/machines/import/MachineImportDialog';
import { useMachineFolders } from '../../features/machines/useMachineFolders';
import MachineCard from '../../features/machines/MachineCard';
import MachineBulkActions from '../../features/machines/MachineBulkActions';
import { useMachineSelection } from '../../features/machines/useMachineSelection';
import { folderDescendants, MachineBreadcrumbs, MachineFolderCard } from '../../features/machines/MachineFolderBrowser';

export default function MachinesPage() {
  const { t } = useI18n();
  const q = useQuery(machinesQuery);
  const selection = useMachineSelection(q.data);
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Machine | 'new' | null>(null);
  const [trusting, setTrusting] = useState<Machine | null>(null);
  const [running, setRunning] = useState<Machine | null>(null);
  const [deleting, setDeleting] = useState<Machine | null>(null);
  const [importing, setImporting] = useState(false);
  const [params] = useSearchParams();
  const folders = useMachineFolders();
  const folderList = folders.data ?? [];
  const current = folderList.find(f => String(f.id) === params.get('folder'));
  const { query, setQuery, filtered } = useCollectionSearch(q.data, (m) => [m.name, m.hostname, m.operatingSystem, m.osVersion]);
  const machines = filtered.filter(m => (m.folderId ?? null) === (current?.id ?? null));
  const needle = query.trim().toLowerCase();
  const visibleFolders = folderList.filter(f => f.parentId === (current?.id ?? null)).filter(f => {
    if (!needle || f.path.toLowerCase().includes(needle)) return true;
    const ids = folderDescendants(f, folderList);
    return filtered.some(m => m.folderId != null && ids.has(m.folderId));
  });
  const visibleFolderIds = new Set(visibleFolders.flatMap(folder => [...folderDescendants(folder, folderList)]));
  const visibleMachineIds = new Set(machines.map(machine => machine.id));
  const selectable = (q.data ?? []).filter(machine => visibleMachineIds.has(machine.id)
    || (machine.folderId != null && visibleFolderIds.has(machine.folderId)));
  const remove = useMutation({
    mutationFn: (id: number) => del('/machines/' + id),
    onSuccess: () => { toast.success(t('machines.deleted')); setDeleting(null); qc.invalidateQueries({ queryKey: ['machines'] }); },
    onError: (e) => { toast.error(errorMessage(e)); setDeleting(null); },
  });
  return (
    <section>
      <PageHeader title={t('machines.title')} subtitle={t('machines.subtitle')} actions={
        <Button icon={selection.active ? <Check size={14} /> : <Pencil size={14} />} aria-pressed={selection.active}
          disabled={selection.busy || (!selection.active && !q.data?.length)} onClick={selection.toggleMode}>
          {t(selection.active ? 'machinesBulk.done' : 'common.edit')}
        </Button>
      } />
      <Fab label={t('common.more')} items={[
        { key: 'add', label: t('machines.add'), icon: <Plus />, onSelect: () => setEditing('new') },
        { key: 'import', label: t('machineImport.title'), icon: <Upload />, onSelect: () => setImporting(true) },
      ]} />
      <MachineBreadcrumbs current={current} folders={folderList} onNavigate={() => setQuery('')} />
      {(!!q.data?.length || !!folderList.length) && <SearchToolbar value={query} onChange={setQuery} placeholder={t('machines.searchPlaceholder')} />}
      <MachineBulkActions selection={selection} visible={selectable} />
      {q.isLoading || folders.isLoading ? <Loading /> : q.error || folders.error ? <ErrorAlert error={q.error || folders.error}
        onRetry={() => { void q.refetch(); void folders.refetch(); }} /> : !q.data?.length && !folderList.length ? (
        <EmptyState title={t('machines.empty')} hint={t('machines.emptyHint')} />
      ) : !machines.length && !visibleFolders.length ? (
        needle ? <NoMatches title={t('machines.noMatch')} hint={t('machines.noMatchHint')} />
          : <EmptyState title={t('machineFolders.empty')} hint={t('machineFolders.emptyHint')} />
      ) : (
        <div className="cards">
          {visibleFolders.map(f => <MachineFolderCard key={'folder-' + f.id} folder={f} folders={folderList}
            machines={q.data ?? []} selection={selection} onNavigate={() => setQuery('')} />)}
          {machines.map(m => <MachineCard key={m.id} machine={m} folderPath={current?.path}
            selected={selection.ids.has(m.id)} selectionDisabled={selection.busy}
            onSelect={selection.active ? () => selection.toggle(m.id) : undefined}
            onRun={() => setRunning(m)} onTrust={() => setTrusting(m)}
            onEdit={() => setEditing(m)} onDelete={() => setDeleting(m)} />)}
        </div>
      )}
      {editing && <MachineForm machine={editing === 'new' ? null : editing} initial={{ folderId: current?.id }} onClose={() => setEditing(null)} />}
      {importing && <MachineImportDialog onClose={() => setImporting(false)} />}
      {trusting && <TrustDialog machine={trusting} onClose={() => setTrusting(null)} />}
      {running && <RunCommandModal initial={{ machineIds: [running.id] }} onClose={() => setRunning(null)} />}
      {deleting && <ConfirmDialog danger title={t('machines.deleteTitle')} message={t('machines.deleteMessage', { name: deleting.name })}
        confirmLabel={t('common.delete')} busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
    </section>
  );
}
