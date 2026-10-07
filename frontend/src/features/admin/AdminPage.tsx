import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, Trash2 } from 'lucide-react';
import { get, post } from '../../shared/api/client';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, ErrorAlert, Loading, PageHeader, errorMessage } from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';

type Summary = Record<string, number>;
type Embeddings = { provider: string; model: string; dimensions: number; commands: number; indexed: number; missing: number; stale: number };

export default function AdminPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const summary = useQuery({ queryKey: ['admin', 'summary'], queryFn: () => get<Summary>('/admin/summary') });
  const emb = useQuery({ queryKey: ['admin', 'embeddings'], queryFn: () => get<Embeddings>('/admin/embeddings') });
  const reindex = useMutation({
    mutationFn: () => post<{ indexed: number }>('/admin/embeddings/reindex'),
    onSuccess: (r) => { toast.success(t('admin.reindexed', { n: r.indexed })); qc.invalidateQueries({ queryKey: ['admin', 'embeddings'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cleanup = useMutation({
    mutationFn: () => post<{ purged: number }>('/admin/files/cleanup'),
    onSuccess: (r) => toast.success(t('admin.purged', { n: r.purged })),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const s = summary.data;
  const card = (key: string, to?: string) => (
    <article className="card stat" key={key}>
      <span className="muted">{t('admin.stat.' + key)}</span>
      <strong>{s?.[key] ?? '…'}</strong>
      {to && <Link to={to}>{t('admin.open')}</Link>}
    </article>
  );
  return (
    <section>
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />
      {summary.error && <ErrorAlert error={summary.error} />}
      {summary.isLoading ? <Loading /> : (
        <div className="cards">
          {card('activeUsers', '/admin/users')}
          {card('pendingCommands', '/admin/commands')}
          {card('datasetsAwaitingReview', '/admin/datasets')}
          {card('activeExecutions', '/executions')}
          {card('machines')}
          {card('approvedCommands')}
          {card('executions')}
        </div>
      )}
      <h2>{t('admin.maintenance')}</h2>
      <div className="cards">
        <article className="card">
          <h3>{t('admin.embeddings')}</h3>
          {emb.data && (
            <div className="kv">
              <span>{t('admin.provider')}</span><span dir="ltr">{emb.data.provider} / {emb.data.model} ({emb.data.dimensions})</span>
              <span>{t('admin.indexed')}</span><span>{emb.data.indexed}/{emb.data.commands}</span>
              <span>{t('admin.stale')}</span><span>{emb.data.stale}</span>
            </div>
          )}
          <Button icon={<RefreshCw size={14} />} busy={reindex.isPending} onClick={() => reindex.mutate()}>{t('admin.reindex')}</Button>
        </article>
        <article className="card">
          <h3>{t('admin.files')}</h3>
          <p className="muted small">{t('admin.cleanupHint')}</p>
          <Button icon={<Trash2 size={14} />} busy={cleanup.isPending} onClick={() => cleanup.mutate()}>{t('admin.cleanup')}</Button>
        </article>
      </div>
    </section>
  );
}
