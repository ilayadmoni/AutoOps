import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Credential } from '../types/api';
import { Button, ConfirmDialog, EmptyState, ErrorAlert, Loading, PageHeader, errorMessage } from '../components';
import CredentialFormModal from '../features/credentials/CredentialFormModal';
import { useCredentials } from '../hooks/useCredentials';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { queryKeys } from '../lib/queryKeys';
import { credentialsService } from '../services/credentials';
import { formatDate } from '../utils/format';

export default function CredentialsPage() {
  const { t, lang } = useI18n();
  const q = useCredentials();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Credential | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Credential | null>(null);
  const remove = useMutation({
    mutationFn: credentialsService.remove,
    onSuccess: () => {
      toast.success(t('credentials.deleted'));
      setDeleting(null);
      qc.invalidateQueries({ queryKey: queryKeys.credentials });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setDeleting(null);
    },
  });
  return (
    <section>
      <PageHeader title={t('credentials.title')} subtitle={t('credentials.subtitle')}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>{t('credentials.add')}</Button>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('credentials.empty')} hint={t('credentials.emptyHint')} />
      ) : (
        <div className="list">
          {q.data.map((c) => (
            <article className="row" key={c.id}>
              <KeyRound size={18} className="muted" />
              <div className="grow">
                <b>{c.name}</b>
                <small className="muted"><span dir="ltr">{c.username}</span> · {t('credentials.updated')} {formatDate(c.updatedAt, lang)}</small>
              </div>
              <span className="badge muted">{c.authType}</span>
              <Button small icon={<Pencil size={14} />} onClick={() => setEditing(c)}>{t('common.edit')}</Button>
              <Button small variant="danger" className="ghost" icon={<Trash2 size={14} />} onClick={() => setDeleting(c)}>{t('common.delete')}</Button>
            </article>
          ))}
        </div>
      )}
      {editing && <CredentialFormModal credential={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog danger title={t('credentials.deleteTitle')} message={t('credentials.deleteMessage', { name: deleting.name })}
          confirmLabel={t('common.delete')} busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />
      )}
    </section>
  );
}
