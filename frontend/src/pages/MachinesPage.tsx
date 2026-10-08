import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { Machine } from '../types/api';
import { Button, ConfirmDialog, EmptyState, ErrorAlert, Loading, PageHeader, errorMessage } from '../components';
import RunCommandModal from '../features/commands/RunCommandModal';
import MachineCard from '../features/machines/MachineCard';
import MachineFormModal from '../features/machines/MachineFormModal';
import TestConnectionDialog from '../features/machines/TestConnectionDialog';
import TrustDialog from '../features/machines/TrustDialog';
import { useI18n } from '../hooks/useI18n';
import { useMachines } from '../hooks/useMachines';
import { useToast } from '../hooks/useToast';
import { queryKeys } from '../lib/queryKeys';
import { machinesService } from '../services/machines';

export default function MachinesPage() {
  const { t } = useI18n();
  const q = useMachines();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Machine | 'new' | null>(null);
  const [trusting, setTrusting] = useState<Machine | null>(null);
  const [testing, setTesting] = useState<Machine | null>(null);
  const [running, setRunning] = useState<Machine | null>(null);
  const [deleting, setDeleting] = useState<Machine | null>(null);
  const remove = useMutation({
    mutationFn: machinesService.remove,
    onSuccess: () => { toast.success(t('machines.deleted')); setDeleting(null); qc.invalidateQueries({ queryKey: queryKeys.machines }); },
    onError: (e) => { toast.error(errorMessage(e)); setDeleting(null); },
  });
  return (
    <section>
      <PageHeader title={t('machines.title')} subtitle={t('machines.subtitle')}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>{t('machines.add')}</Button>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('machines.empty')} hint={t('machines.emptyHint')} />
      ) : (
        <div className="cards">
          {q.data.map((m) => (
            <MachineCard
              key={m.id} machine={m}
              onTrust={() => setTrusting(m)} onTest={() => setTesting(m)} onRun={() => setRunning(m)}
              onEdit={() => setEditing(m)} onDelete={() => setDeleting(m)}
            />
          ))}
        </div>
      )}
      {editing && <MachineFormModal machine={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {trusting && <TrustDialog machine={trusting} onClose={() => setTrusting(null)} />}
      {testing && <TestConnectionDialog machine={testing} onClose={() => setTesting(null)} />}
      {running && <RunCommandModal initial={{ machineIds: [running.id] }} onClose={() => setRunning(null)} />}
      {deleting && <ConfirmDialog danger title={t('machines.deleteTitle')} message={t('machines.deleteMessage', { name: deleting.name })}
        confirmLabel={t('common.delete')} busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
    </section>
  );
}
