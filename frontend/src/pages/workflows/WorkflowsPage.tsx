import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Copy, Pencil, Play, Trash2 } from 'lucide-react';
import { del, get, post } from '../../services/client';
import type { WorkflowSummary, WorkflowView } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import {
  Button, ButtonLink, Card, ConfirmDialog, EmptyState, ErrorAlert, errorMessage, Fab, IconButton, Loading, NoMatches, PageHeader, SearchToolbar, useCollectionSearch,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../utils/format';
import RunWorkflowModal from '../../features/workflows/RunWorkflowModal';

export default function WorkflowsPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['workflows'], queryFn: () => get<WorkflowSummary[]>('/workflows') });
  const { query, setQuery, filtered } = useCollectionSearch(q.data, (w) => [w.name, w.description]);
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
      <PageHeader title={t('workflows.title')} subtitle={t('workflows.subtitle')} />
      <Fab to="/workflows/new" label={t('workflows.create')} />
      {!!q.data?.length && <SearchToolbar value={query} onChange={setQuery} placeholder={t('workflows.searchPlaceholder')} />}
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('workflows.empty')} hint={t('workflows.emptyHint')} action={<ButtonLink variant="primary" to="/workflows/new">{t('workflows.create')}</ButtonLink>} />
      ) : !filtered.length ? (
        <NoMatches title={t('workflows.noMatch')} hint={t('workflows.noMatchHint')} />
      ) : (
        <div className="cards">
          {filtered.map((w) => (
            <Card key={w.id}>
              <div className="row spread"><h3 dir="auto">{w.name}</h3></div>
              {w.description && <p className="muted">{w.description}</p>}
              <small className="muted">{t('workflows.steps', { n: w.stepCount })} · {t('workflows.updated')} <bdi>{formatDate(w.updatedAt, lang)}</bdi></small>
              <div className="cardFoot">
                <Button small variant="primary" icon={<Play size={14} />} onClick={() => setRunning(w)}>{t('workflows.run')}</Button>
                <ButtonLink small to={`/workflows/${w.id}/edit`} icon={<Pencil size={14} />}>{t('common.edit')}</ButtonLink>
                <span className="grow" />
                <IconButton label={t('workflows.duplicate')} onClick={() => duplicate.mutate(w.id)}><Copy size={14} /></IconButton>
                <IconButton danger label={t('common.delete')} onClick={() => setDeleting(w)}><Trash2 size={14} /></IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}
      {running && <RunWorkflowModal workflowId={running.id} name={running.name} onClose={() => setRunning(null)} />}
      {deleting && <ConfirmDialog danger title={t('workflows.deleteTitle')} message={t('workflows.deleteMessage', { name: deleting.name })} confirmLabel={t('common.delete')}
        busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
    </section>
  );
}
