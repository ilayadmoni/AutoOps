import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import type { StepRunView } from '../../types/api';
import { Button, Code, ConfirmDialog, Output, RiskBadge, StatusBadge, errorMessage } from '../../components';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/queryKeys';
import { executionsService } from '../../services/executions';
import { duration } from '../../utils/format';

export default function StepRunItem({ step, live, executionId }: { step: StepRunView; live?: string; executionId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(step.status === 'FAILED');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (step.status === 'FAILED') setOpen(true);
  }, [step.status]);
  const retry = useMutation({
    mutationFn: () => executionsService.retryStep(step.id, step.riskLevel === 'HIGH'),
    onSuccess: (d) => { setConfirm(false); qc.setQueryData(queryKeys.executions.detail(executionId), d); toast.success(t('execution.retryStarted')); },
    onError: (e) => { setConfirm(false); toast.error(errorMessage(e)); },
  });
  const running = step.status === 'RUNNING';
  return (
    <li className={'step ' + step.status.toLowerCase()}>
      <div className="row spread wrap">
        <Button
          small className="ghost" aria-expanded={open} onClick={() => setOpen(!open)}
          icon={open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        >
          <b>{step.stepName}</b>
          {step.attemptNumber > 1 && <span className="badge info">{t('execution.attempt', { n: step.attemptNumber })}</span>}
        </Button>
        <div className="row gap wrap">
          <small className="muted">{t('steps.' + (step.stepType ?? 'COMMAND'))}</small>
          {step.riskLevel && <RiskBadge risk={step.riskLevel} />}
          {step.runWithSudo && <span className="badge warn">sudo</span>}
          {step.exitCode != null && <span className="badge muted" dir="ltr">exit {step.exitCode}</span>}
          <StatusBadge status={step.status} />
          <small className="muted">{duration(step.startedAt, step.finishedAt)}</small>
          {step.retryable && <Button small icon={<RotateCcw size={14} />} onClick={() => setConfirm(true)}>{t('execution.retry')}</Button>}
        </div>
      </div>
      {step.failureReason && <small className="fieldError">{step.failureReason}</small>}
      {(open || running) && (
        <div className="stepBody">
          {step.resolvedCommand && <Code>{step.resolvedCommand}</Code>}
          {running && live && <Output label={t('execution.liveOutput')} text={live} />}
          <Output label="stdout" text={step.stdout} />
          <Output label="stderr" text={step.stderr} tone="err" />
        </div>
      )}
      {confirm && <ConfirmDialog danger={step.riskLevel === 'HIGH'} title={t('execution.retryTitle')} message={t('execution.retryMessage', { name: step.stepName ?? '' })}
        acknowledge={step.riskLevel === 'HIGH' ? t('approvals.ack') : undefined} confirmLabel={t('execution.retry')} busy={retry.isPending}
        onCancel={() => setConfirm(false)} onConfirm={() => retry.mutate()} />}
    </li>
  );
}
