import type { MachineRunView } from '../../types/api';
import { StatusBadge } from '../../components';
import { useI18n } from '../../hooks/useI18n';
import { duration } from '../../utils/format';
import StepRunItem from './StepRunItem';

const PREFLIGHT_KEYS = ['parametersStatus', 'filesStatus', 'hostVerificationStatus', 'sshStatus', 'authenticationStatus', 'osStatus', 'sudoStatus'] as const;

export default function MachineRunCard({ run, liveOutput, executionId }: { run: MachineRunView; liveOutput: Record<number, string>; executionId: number }) {
  const { t } = useI18n();
  const p = run.preflight;
  return (
    <article className="card machineRun">
      <div className="row spread wrap">
        <div>
          <h3>{run.machineName} <small className="muted" dir="ltr">{run.hostname}</small></h3>
          {run.credentialName && <small className="muted">{t('run.credential')}: {run.credentialName}</small>}
        </div>
        <div className="row gap"><StatusBadge status={run.status} /><small className="muted">{duration(run.startedAt, run.finishedAt)}</small></div>
      </div>
      {run.failureReason && <div className={'alert small ' + (run.status === 'FAILED' ? 'danger' : 'warn')}>{run.failureReason}</div>}
      {p && (
        <div className="preflight">
          <span className="muted small">{t('preflight.title')} <StatusBadge status={p.status} /></span>
          <div className="checks">
            {PREFLIGHT_KEYS.map((k) => <div key={k} className="checkItem"><span>{t('preflight.' + k)}</span><StatusBadge status={p[k] ?? null} /></div>)}
          </div>
          {p.failureReason && <small className="fieldError">{p.failureReason}</small>}
        </div>
      )}
      <ol className="timeline">
        {run.steps.map((s) => <StepRunItem key={s.id} step={s} live={liveOutput[s.id]} executionId={executionId} />)}
        {run.steps.length === 0 && <li className="muted small">{t('execution.noSteps')}</li>}
      </ol>
    </article>
  );
}
