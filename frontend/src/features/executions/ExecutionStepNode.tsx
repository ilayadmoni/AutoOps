import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, FileUp, RotateCcw, TerminalSquare } from 'lucide-react';
import type { ExecutionDetail, StepRunView } from '../../types/api';
import { post } from '../../services/client';
import { Button, Code, ConfirmDialog, Output, RiskBadge, errorMessage } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../app/providers/I18nProvider';
import { duration } from '../../utils/format';
import PipelineNode from './PipelineNode';

const ICONS = { COMMAND: TerminalSquare, FILE_TRANSFER: FileUp, WAIT_UNTIL: Clock };

export default function ExecutionStepNode({ step, index, live, executionId }: {
  step: StepRunView; index: number; live?: string; executionId: number;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(step.status === 'FAILED');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (step.status === 'FAILED') setOpen(true);
  }, [step.status]);
  const retry = useMutation({
    mutationFn: () => post<ExecutionDetail>(`/executions/steps/${step.id}/retry`, { highRiskAcknowledged: step.riskLevel === 'HIGH' }),
    onSuccess: (data) => {
      setConfirm(false); qc.setQueryData(['execution', executionId], data); toast.success(t('execution.retryStarted'));
    },
    onError: (error) => { setConfirm(false); toast.error(errorMessage(error)); },
  });
  const type = step.stepType ?? 'COMMAND';
  return (
    <PipelineNode status={step.status} name={step.stepName ?? t('steps.' + type)} index={index}
      icon={ICONS[type as keyof typeof ICONS] ?? TerminalSquare} open={open} onToggle={() => setOpen(!open)}
      subtitle={<>{t('steps.' + type)}{step.attemptNumber > 1 && <> · {t('execution.attempt', { n: step.attemptNumber })}</>}</>}>
      <div className="row gap wrap">
        {step.riskLevel && <RiskBadge risk={step.riskLevel} />}
        {step.runWithSudo && <span className="badge warn">sudo</span>}
        {step.exitCode != null && <span className="badge muted" dir="ltr">exit {step.exitCode}</span>}
        <small className="muted">{duration(step.startedAt, step.finishedAt)}</small>
        {step.retryable && <Button small icon={<RotateCcw size={14} />} onClick={() => setConfirm(true)}>{t('execution.retry')}</Button>}
      </div>
      {step.failureReason && <small className="fieldError">{step.failureReason}</small>}
      {step.resolvedCommand && <Code>{step.resolvedCommand}</Code>}
      {step.status === 'RUNNING' && live && <Output label={t('execution.liveOutput')} text={live} />}
      <Output label="stdout" text={step.stdout} />
      <Output label="stderr" text={step.stderr} tone="err" />
      {confirm && <ConfirmDialog danger={step.riskLevel === 'HIGH'} title={t('execution.retryTitle')}
        message={t('execution.retryMessage', { name: step.stepName ?? '' })}
        acknowledge={step.riskLevel === 'HIGH' ? t('approvals.ack') : undefined}
        confirmLabel={t('execution.retry')} busy={retry.isPending}
        onCancel={() => setConfirm(false)} onConfirm={() => retry.mutate()} />}
    </PipelineNode>
  );
}
