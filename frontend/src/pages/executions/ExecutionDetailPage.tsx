import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Octagon, Radio } from 'lucide-react';
import { get, post, streamEvents } from '../../services/client';
import type { ExecutionDetail } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  Button, Code, ConfirmDialog, ErrorAlert, Loading, PageHeader, RiskBadge, StatusBadge, errorMessage,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { duration, formatDate, isTerminal } from '../../utils/format';
import ExecutionPipeline from '../../features/executions/ExecutionPipeline';
import { ApprovalCard } from '../../features/executions/ApprovalCard';

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
      <ExecutionPipeline machines={machines} liveOutput={liveOutput} executionId={executionId} />
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
