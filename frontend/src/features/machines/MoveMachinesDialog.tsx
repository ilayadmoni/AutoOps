import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderInput } from 'lucide-react';
import type { Machine, MachineFolder } from '../../types/api';
import { post } from '../../services/client';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, ErrorAlert, Field, Loading, Modal, Select } from '../../components/ui';
import { useMachineFolders } from './useMachineFolders';
import { useToast } from '../../components/ui/Toast';

export type MoveTarget = { kind: 'machines'; machines: Machine[] } | { kind: 'folder'; folder: MachineFolder };

export default function MoveMachinesDialog({ target, onClose, onMoved }: {
  target: MoveTarget; onClose: () => void; onMoved: () => void;
}) {
  const { t } = useI18n();
  const folders = useMachineFolders();
  const qc = useQueryClient();
  const toast = useToast();
  const [destination, setDestination] = useState('');
  const source = target.kind === 'folder' ? target.folder : null;
  const available = (folders.data ?? []).filter(f => !source || (f.id !== source.id && !f.path.startsWith(source.path + '/')));
  const move = useMutation({
    mutationFn: () => {
      const folderId = destination === 'root' ? null : Number(destination);
      return target.kind === 'folder' ? post(`/machine-folders/${target.folder.id}/move`, { folderId })
        : post('/machines/move', { folderId, machineIds: target.machines.map(m => m.id) });
    },
    onSuccess: async () => {
      await Promise.all(['machines', 'machine-folders'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(t('fleet.moved')); onMoved(); onClose();
    },
  });
  const close = () => { if (!move.isPending) onClose(); };
  return <Modal title={t(source ? 'fleet.moveFolder' : 'fleet.moveMachines')} onClose={close} footer={<>
    <Button disabled={move.isPending} onClick={close}>{t('common.cancel')}</Button>
    <Button variant="primary" icon={<FolderInput size={16} />} busy={move.isPending}
      disabled={!destination || folders.isPending || folders.isError} onClick={() => move.mutate()}>{t('fleet.move')}</Button>
  </>}>
    <div className="stack">
      <ErrorAlert error={move.error || folders.error} onRetry={folders.error ? () => folders.refetch() : undefined} />
      <p className="muted">{t(source ? 'fleet.moveFolderHint' : 'fleet.moveMachinesHint')}</p>
      <ul className="machineMoveItems">{source ? <li dir="auto">{source.path}</li>
        : target.kind === 'machines' && target.machines.map(m => <li key={m.id} dir="auto">{m.name}</li>)}</ul>
      {folders.isPending ? <Loading /> : <Field label={t('fleet.destination')}>
        <Select block aria-label={t('fleet.destination')} value={destination} placeholder={t('fleet.chooseDestination')}
          options={[{ value: 'root', label: t('machineFolders.all') }, ...available.map(f => ({ value: String(f.id), label: f.path }))]}
          onChange={e => setDestination(e.target.value)} />
      </Field>}
    </div>
  </Modal>;
}
