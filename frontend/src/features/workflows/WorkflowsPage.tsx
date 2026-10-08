import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Copy, Pencil, Play, Trash2 } from 'lucide-react';
import { del, get, post } from '../../shared/api/client';
import type { WorkflowSummary, WorkflowView } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import {
  Button, ButtonLink, Card, ConfirmDialog, EmptyState, ErrorAlert, errorMessage, Fab, IconButton, Loading, PageHeader,
} from '../../shared/ui';
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
      <PageHeader title={t('workflows.title')} subtitle={t('workflows.subtitle')} />
      <Fab to="/workflows/new" label={t('workflows.create')} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('workflows.empty')} hint={t('workflows.emptyHint')} action={<ButtonLink variant="primary" to="/workflows/new">{t('workflows.create')}</ButtonLink>} />
      ) : (
        <div className="cards">
          {q.data.map((w) => (
            <Card key={w.id}>
              <h3 dir="auto">{w.name}</h3>
              {w.description && <p className="muted">{w.description}</p>}
              <small className="muted">{t('workflows.steps', { n: w.stepCount })} · {t('workflows.updated')} {formatDate(w.updatedAt, lang)}</small>
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
