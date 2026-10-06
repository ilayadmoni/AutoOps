import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { ApiError, post } from '../../shared/api/client';
import type { ExecutionDetail, RunOptions } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { ErrorAlert, Modal, Spinner } from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { RunOptionsForm, defaultRunOptions } from '../executions/RunOptionsForm';

export default function RunWorkflowModal({ workflowId, name, onClose }: { workflowId: number; name: string; onClose: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const [options, setOptions] = useState<RunOptions>(defaultRunOptions());
  const run = useMutation({
    mutationFn: () => post<ExecutionDetail>(`/workflows/${workflowId}/run`, { ...options, credentialId: options.credentialId || null }),
    onSuccess: (d) => { toast.success(t('run.started')); onClose(); nav('/executions/' + d.summary.id); },
  });
  return (
    <Modal wide title={t('workflows.runTitle', { name })} onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!options.machineIds.length || run.isPending} onClick={() => run.mutate()}>{run.isPending ? <Spinner /> : <Play size={14} />} {t('run.start')}</button>
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
