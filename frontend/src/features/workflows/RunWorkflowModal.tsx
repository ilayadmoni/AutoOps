import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { ApiError, post } from '../../services/client';
import type { ExecutionDetail, RunOptions } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, ErrorAlert, Modal } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { RunOptionsForm, defaultRunOptions, machinesQuery } from '../executions/RunOptionsForm';

/** `initialMachineIds` preselects servers (for instance the ones mentioned in a conversation); unknown ids are dropped. */
export default function RunWorkflowModal({ workflowId, name, initialMachineIds = [], onClose }: {
  workflowId: number; name: string; initialMachineIds?: number[]; onClose: () => void;
}) {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const [options, setOptions] = useState<RunOptions>(defaultRunOptions(initialMachineIds));
  const machines = useQuery(machinesQuery);
  useEffect(() => {
    if (!machines.data) return;
    const known = new Set(machines.data.map((m) => m.id));
    setOptions((current) => (current.machineIds.every((id) => known.has(id)) ? current : { ...current, machineIds: current.machineIds.filter((id) => known.has(id)) }));
  }, [machines.data]);
  const run = useMutation({
    mutationFn: () => post<ExecutionDetail>(`/workflows/${workflowId}/run`, { ...options, credentialId: options.credentialId || null }),
    onSuccess: (d) => { toast.success(t('run.started')); onClose(); nav('/executions/' + d.summary.id); },
  });
  return (
    <Modal wide title={t('workflows.runTitle', { name })} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="primary" icon={<Play size={14} />} busy={run.isPending}
          disabled={!options.machineIds.length} onClick={() => run.mutate()}
        >
          {t('run.start')}
        </Button>
      </>
    }>
      <div className="stack">
        <ErrorAlert error={run.error} />
        <p className="muted small">{t('workflows.runHint')}</p>
        <RunOptionsForm value={options} onChange={setOptions} errors={(run.error as ApiError | null)?.fieldErrors} />
      </div>
    </Modal>
  );
}
