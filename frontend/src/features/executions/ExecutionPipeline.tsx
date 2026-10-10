import { Server } from 'lucide-react';
import type { MachineRunView } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { StatusBadge } from '../../components/ui';
import { duration, isTerminal } from '../../utils/format';
import ExecutionStepNode from './ExecutionStepNode';
import PreflightNode from './PreflightNode';

/** The same execution monitor is used by command, chat and workflow entry points. */
export default function ExecutionPipeline({ machines, liveOutput, executionId }: {
  machines: MachineRunView[]; liveOutput: Record<number, string>; executionId: number;
}) {
  const { t } = useI18n();
  return (
    <div className="executionPipelines" role="region" aria-label={t('nav.executions')} tabIndex={0}>
      {machines.map((run) => (
        <article className="executionColumn" key={run.id} aria-labelledby={`machine-run-${run.id}`}>
          <header className="executionColumnHead">
            <div className="row gap"><Server size={16} aria-hidden="true" />
              <h3 id={`machine-run-${run.id}`} dir="auto">{run.machineName}</h3>
            </div>
            {run.hostname && <small className="muted" dir="ltr">{run.hostname}</small>}
            <div className="row spread wrap"><StatusBadge status={run.status} />
              <small className="muted">{duration(run.startedAt, run.finishedAt)}</small>
            </div>
            {run.credentialName && <small className="muted">{t('run.credential')}: {run.credentialName}</small>}
            {run.failureReason && <div className={'alert small ' + (run.status === 'FAILED' ? 'danger' : 'warn')}>{run.failureReason}</div>}
          </header>
          <ol className="executionNodes" aria-label={run.machineName}>
            <PreflightNode preflight={run.preflight} machineStatus={run.status} />
            {run.steps.map((step, index) => <ExecutionStepNode key={step.id} step={step} index={index + 1}
              live={liveOutput[step.id]} executionId={executionId} />)}
          </ol>
          {run.steps.length === 0 && <p className="executionEmpty muted small">
            {isTerminal(run.status) ? t('execution.noSteps') : t('status.' + run.status, undefined, run.status)}
          </p>}
        </article>
      ))}
    </div>
  );
}
