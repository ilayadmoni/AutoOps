import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { del, get, post } from '../../shared/api/client';
import type { WorkflowSummary, WorkflowView } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { ConfirmDialog, EmptyState, ErrorAlert, Loading, PageHeader, errorMessage } from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { formatDate } from '../../shared/format';
import RunWorkflowModal from './RunWorkflowModal';

export default function WorkflowsPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['workflows'], queryFn: () => get<WorkflowSummary[]>('/workflows') });
  const [running, setRunning] = useState<WorkflowSummary | null>(null);
  const [deleting, setDeleting] = useState<WorkflowSummary | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => del('/workflows/' + id),
    onSuccess: () => { toast.success(t('workflows.deleted')); setDeleting(null); qc.invalidateQueries({ queryKey: ['workflows'] }); },
    onError: (e) => { toast.error(errorMessage(e)); setDeleting(null); },
  });
  const duplicate = useMutation({
    mutationFn: (id: number) => post<WorkflowView>(`/workflows/${id}/duplicate`),
    onSuccess: (w) => { qc.invalidateQueries({ queryKey: ['workflows'] }); nav(`/workflows/${w.id}/edit`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <section>
      <PageHeader title={t('workflows.title')} subtitle={t('workflows.subtitle')}
        actions={<Link className="btn primary" to="/workflows/new"><Plus size={16} /> {t('workflows.create')}</Link>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('workflows.empty')} hint={t('workflows.emptyHint')} action={<Link className="btn primary" to="/workflows/new">{t('workflows.create')}</Link>} />
      ) : (
        <div className="cards">
          {q.data.map((w) => (
            <article className="card" key={w.id}>
              <h3>{w.name}</h3>
              {w.description && <p className="muted">{w.description}</p>}
              <small className="muted">{t('workflows.steps', { n: w.stepCount })} · {t('workflows.updated')} {formatDate(w.updatedAt, lang)}</small>
              <div className="row gap wrap">
                <button className="btn small primary" onClick={() => setRunning(w)}><Play size={14} /> {t('workflows.run')}</button>
                <Link className="btn small" to={`/workflows/${w.id}/edit`}><Pencil size={14} /> {t('common.edit')}</Link>
                <button className="btn small ghost" onClick={() => duplicate.mutate(w.id)}><Copy size={14} /></button>
                <button className="btn small ghost danger" onClick={() => setDeleting(w)}><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      {running && <RunWorkflowModal workflowId={running.id} name={running.name} onClose={() => setRunning(null)} />}
      {deleting && <ConfirmDialog danger title={t('workflows.deleteTitle')} message={t('workflows.deleteMessage', { name: deleting.name })} confirmLabel={t('common.delete')}
        busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
    </section>
  );
}
