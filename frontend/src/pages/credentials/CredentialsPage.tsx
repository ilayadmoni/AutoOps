import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import { del, get } from '../../services/client';
import type { Credential } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import {
  Button, Card, Code, ConfirmDialog, EmptyState, ErrorAlert, errorMessage, Fab, IconButton, Loading, NoMatches, PageHeader, SearchToolbar, useCollectionSearch,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../utils/format';
import CredentialForm from '../../features/credentials/CredentialForm';

export const credentialsQuery = { queryKey: ['credentials'], queryFn: () => get<Credential[]>('/credentials') };

export default function CredentialsPage() {
  const { t, lang } = useI18n();
  const q = useQuery(credentialsQuery);
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Credential | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Credential | null>(null);
  const { query, setQuery, filtered } = useCollectionSearch(q.data, (c) => [c.name, c.username, c.authType]);
  const remove = useMutation({
    mutationFn: (id: number) => del('/credentials/' + id),
    onSuccess: () => {
      toast.success(t('credentials.deleted'));
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['credentials'] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setDeleting(null);
    },
  });
  return (
    <section>
      <PageHeader title={t('credentials.title')} subtitle={t('credentials.subtitle')} />
      <Fab label={t('credentials.add')} onClick={() => setEditing('new')} />
      {!!q.data?.length && <SearchToolbar value={query} onChange={setQuery} placeholder={t('credentials.searchPlaceholder')} />}
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('credentials.empty')} hint={t('credentials.emptyHint')} />
      ) : !filtered.length ? (
        <NoMatches title={t('credentials.noMatch')} hint={t('credentials.noMatchHint')} />
      ) : (
        <div className="cards">
          {filtered.map((c) => (
            <Card key={c.id}>
              <div className="row spread">
                <h3 dir="auto"><KeyRound size={16} className="muted" /> {c.name}</h3>
                <span className="badge muted">{c.authType}</span>
              </div>
              <div><Code>{c.username}</Code></div>
              <small className="muted">{t('credentials.updated')} <bdi>{formatDate(c.updatedAt, lang)}</bdi></small>
              <div className="cardFoot">
                <Button small icon={<Pencil size={14} />} onClick={() => setEditing(c)}>{t('common.edit')}</Button>
                <span className="grow" />
                <IconButton danger label={t('common.delete')} onClick={() => setDeleting(c)}><Trash2 size={14} /></IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <CredentialForm credential={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog danger title={t('credentials.deleteTitle')} message={t('credentials.deleteMessage', { name: deleting.name })}
          confirmLabel={t('common.delete')} busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />
      )}
    </section>
  );
}
