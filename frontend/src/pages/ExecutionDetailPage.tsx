import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Octagon, Radio } from 'lucide-react';
import {
  Button, Code, ConfirmDialog, ErrorAlert, Loading, PageHeader, RiskBadge, StatusBadge, errorMessage,
} from '../components';
import ApprovalCard from '../features/approvals/ApprovalCard';
import MachineRunCard from '../features/executions/MachineRunCard';
import { useLiveExecution } from '../features/executions/useLiveExecution';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { queryKeys } from '../lib/queryKeys';
import { executionsService } from '../services/executions';
import { duration, formatDate } from '../utils/format';

export default function ExecutionDetailPage() {
  const { id } = useParams();
  const executionId = Number(id);
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmStop, setConfirmStop] = useState(false);
  const { query: q, terminal, live, liveOutput } = useLiveExecution(executionId);

  const stop = useMutation({
    mutationFn: () => executionsService.stop(executionId),
    onSuccess: (d) => { qc.setQueryData(queryKeys.executions.detail(executionId), d); setConfirmStop(false); toast.success(t('execution.stopRequested')); },
    onError: (e) => { setConfirmStop(false); toast.error(errorMessage(e)); },
  });

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorAlert error={q.error} onRetry={() => q.refetch()} />;
  const { summary: s, machines, approvals } = q.data;
  const pending = approvals.filter((a) => a.status === 'PENDING');
  const owner = user?.id === s.startedBy;
  return (
    <section>
      <Link to="/executions" className="back"><ArrowLeft size={14} /> {t('nav.executions')}</Link>
      <PageHeader
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
        {machines.map((m) => <MachineRunCard key={m.id} run={m} liveOutput={liveOutput} executionId={executionId} />)}
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
