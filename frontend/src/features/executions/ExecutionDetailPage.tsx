import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Octagon, RotateCcw, Radio, ChevronDown, ChevronRight } from 'lucide-react';
import { get, post, streamEvents } from '../../shared/api/client';
import type { ExecutionDetail, MachineRunView, StepRunView } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import {
  Button, Code, ConfirmDialog, ErrorAlert, Loading, Output, PageHeader, RiskBadge, StatusBadge, errorMessage,
} from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { duration, formatDate, isTerminal } from '../../shared/format';
import { ApprovalCard } from './ApprovalCard';

export default function ExecutionDetailPage() {
  const { id } = useParams();
  const executionId = Number(id);
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [live, setLive] = useState(false);
  const [liveOutput, setLiveOutput] = useState<Record<number, string>>({});
  const [confirmStop, setConfirmStop] = useState(false);
  const q = useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => get<ExecutionDetail>('/executions/' + executionId),
    // Polling fallback: fast when the live stream is down, slow safety net while it is up, off when finished.
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d && isTerminal(d.summary.status)) return false;
      return live ? 10000 : 2000;
    },
  });
  const terminal = q.data ? isTerminal(q.data.summary.status) : false;
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!q.data || terminal) return;
    let closed = false;
    let stop: (() => void) | null = null;
    let retry: number | undefined;
    const connect = () => {
      stop = streamEvents(`/executions/${executionId}/events`, (type, data) => {
        setLive(true);
        if (type === 'STEP_OUTPUT') {
          const d = data as { stepRunId: number; chunk: string };
          setLiveOutput((o) => ({ ...o, [d.stepRunId]: ((o[d.stepRunId] ?? '') + d.chunk).slice(-20000) }));
          return;
        }
        if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(() => qc.invalidateQueries({ queryKey: ['execution', executionId] }), 150);
      }, () => {
        setLive(false);
        if (!closed) retry = window.setTimeout(connect, 3000);
      });
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(retry);
      stop?.();
    };
  }, [executionId, terminal, !!q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useMutation({
    mutationFn: () => post<ExecutionDetail>(`/executions/${executionId}/stop`),
    onSuccess: (d) => { qc.setQueryData(['execution', executionId], d); setConfirmStop(false); toast.success(t('execution.stopRequested')); },
    onError: (e) => { setConfirmStop(false); toast.error(errorMessage(e)); },
  });

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorAlert error={q.error} onRetry={() => q.refetch()} />;
  const { summary: s, machines, approvals } = q.data;
  const pending = approvals.filter((a) => a.status === 'PENDING');
  const owner = user?.id === s.startedBy;
  return (
    <section>
      <PageHeader
        back={{ to: '/executions', label: t('nav.executions') }}
        title={<>#{s.id} {s.title} <StatusBadge status={s.status} /></>}
        subtitle={<>{t('executions.type.' + s.type)} · {t('run.' + s.mode.toLowerCase())} · {t('run.concurrency')} {s.concurrency} · {t('run.' + (s.failurePolicy === 'CONTINUE' ? 'continue' : 'stopNew'))}</>}
        actions={<>
          {!terminal && <span className={'badge ' + (live ? 'ok' : 'muted')}><Radio size={12} /> {live ? t('execution.live') : t('execution.polling')}</span>}
          {!terminal && owner && (
            <Button
              variant="danger" icon={<Octagon size={14} />}
              disabled={s.cancelRequested} busy={stop.isPending} onClick={() => setConfirmStop(true)}
            >
              {s.cancelRequested ? t('execution.stopping') : t('execution.stop')}
            </Button>
          )}
        </>}
      />
      <div className="summaryGrid">
        <div><span className="muted">{t('executions.risk')}</span><RiskBadge risk={s.riskLevel} /></div>
        <div><span className="muted">{t('executions.started')}</span>{formatDate(s.startedAt ?? s.createdAt, lang)}</div>
        <div><span className="muted">{t('execution.finished')}</span>{formatDate(s.finishedAt, lang)}</div>
        <div><span className="muted">{t('executions.duration')}</span>{duration(s.startedAt, s.finishedAt)}</div>
        <div><span className="muted">{t('executions.machines')}</span>{s.succeededMachines}/{s.machineCount}</div>
      </div>
      {s.failureReason && <div className={'alert ' + (s.status === 'CANCELLED' ? 'warn' : 'danger')}>{s.failureReason}</div>}
      {s.cancelRequested && !terminal && <div className="alert warn">{t('execution.stopSemantics')}</div>}
      {Object.keys(q.data.parameters).length > 0 && (
        <div className="paramsLine">{t('commands.parameters')}: {Object.entries(q.data.parameters).map(([k, v]) => <Code key={k}>{k}={v}</Code>)}{q.data.runWithSudo && <span className="badge warn">sudo</span>}</div>
      )}
      {owner && pending.map((a) => <ApprovalCard key={a.id} approval={a} />)}
      <div className="stack">
        {machines.map((m) => <MachineRun key={m.id} run={m} liveOutput={liveOutput} executionId={executionId} />)}
      </div>
      {approvals.filter((a) => a.status !== 'PENDING').length > 0 && (
        <details className="card">
          <summary>{t('execution.approvalHistory')}</summary>
          <table className="table">
            <thead><tr><th>{t('approvals.scope')}</th><th>{t('common.status')}</th><th>{t('executions.risk')}</th><th>{t('approvals.decidedAt')}</th><th>{t('approvals.comment')}</th></tr></thead>
            <tbody>{approvals.filter((a) => a.status !== 'PENDING').map((a) => (
              <tr key={a.id}><td>{t('approvals.scope.' + a.scope)}{a.stepName ? ' · ' + a.stepName : ''}</td><td><StatusBadge status={a.status} />{a.highRiskAcknowledged && <span className="badge bad">{t('approvals.acknowledged')}</span>}</td><td><RiskBadge risk={a.riskLevel} /></td><td>{formatDate(a.decidedAt, lang)}</td><td>{a.comment}</td></tr>
            ))}</tbody>
          </table>
        </details>
      )}
      {confirmStop && <ConfirmDialog danger title={t('execution.stopTitle')} message={t('execution.stopSemantics')} confirmLabel={t('execution.stop')}
        busy={stop.isPending} onCancel={() => setConfirmStop(false)} onConfirm={() => stop.mutate()} />}
    </section>
  );
}

const PREFLIGHT_KEYS = ['parametersStatus', 'filesStatus', 'hostVerificationStatus', 'sshStatus', 'authenticationStatus', 'osStatus', 'sudoStatus'] as const;

function MachineRun({ run, liveOutput, executionId }: { run: MachineRunView; liveOutput: Record<number, string>; executionId: number }) {
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
        {run.steps.map((s) => <StepItem key={s.id} step={s} live={liveOutput[s.id]} executionId={executionId} />)}
        {run.steps.length === 0 && <li className="muted small">{t('execution.noSteps')}</li>}
      </ol>
    </article>
  );
}

function StepItem({ step, live, executionId }: { step: StepRunView; live?: string; executionId: number }) {
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
    onSuccess: (d) => { setConfirm(false); qc.setQueryData(['execution', executionId], d); toast.success(t('execution.retryStarted')); },
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
