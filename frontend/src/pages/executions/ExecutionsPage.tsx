import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '../../services/client';
import type { ExecutionSummary, Page } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { useAuth } from '../../app/providers/AuthProvider';
import { Button, Checkbox, EmptyState, ErrorAlert, Loading, PageHeader, RiskBadge, StatusBadge } from '../../components/ui';
import { duration, formatDate, isTerminal } from '../../utils/format';

export default function ExecutionsPage() {
  const { t, lang } = useI18n();
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(0);
  const [all, setAll] = useState(false);
  const q = useQuery({
    queryKey: ['executions', all, page],
    queryFn: () => get<Page<ExecutionSummary>>((all ? '/admin/executions' : '/executions') + `?page=${page}&size=20`),
    refetchInterval: (query) => (query.state.data?.items.some((e) => !isTerminal(e.status)) ? 4000 : false),
  });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.size)) : 1;
  return (
    <section>
      <PageHeader title={t('executions.title')} subtitle={t('executions.subtitle')}
        actions={isAdmin && <Checkbox checked={all} onChange={(e) => { setAll(e.target.checked); setPage(0); }} label={t('executions.allUsers')} />} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.items.length ? (
        <EmptyState title={t('executions.empty')} hint={t('executions.emptyHint')} />
      ) : (
        <>
          <table className="table">
            <thead>
              <tr><th>#</th><th>{t('executions.what')}</th><th>{t('common.status')}</th><th>{t('executions.risk')}</th><th>{t('executions.machines')}</th><th>{t('executions.started')}</th><th>{t('executions.duration')}</th></tr>
            </thead>
            <tbody>
              {q.data.items.map((e) => (
                <tr key={e.id}>
                  <td><Link to={'/executions/' + e.id}>#{e.id}</Link></td>
                  <td><Link to={'/executions/' + e.id}>{e.title ?? e.type}</Link> <small className="muted">{t('executions.type.' + e.type)} · {t('run.' + e.mode.toLowerCase())}</small></td>
                  <td><StatusBadge status={e.status} />{e.pendingApprovals > 0 && <span className="badge warn">{t('executions.needsApproval')}</span>}</td>
                  <td><RiskBadge risk={e.riskLevel} /></td>
                  <td className="tabular">{e.succeededMachines}/{e.machineCount}{e.failedMachines > 0 && <span className="badge bad">{e.failedMachines} {t('executions.failed')}</span>}</td>
                  <td>{formatDate(e.startedAt ?? e.createdAt, lang)}</td>
                  <td>{duration(e.startedAt, e.finishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pager">
            <Button small disabled={page === 0} onClick={() => setPage(page - 1)}>{t('common.previous')}</Button>
            <span className="tabular">{page + 1} / {pages}</span>
            <Button small disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{t('common.next')}</Button>
          </div>
        </>
      )}
    </section>
  );
}
