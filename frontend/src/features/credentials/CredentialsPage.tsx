import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { del, get, post, put } from '../../shared/api/client';
import type { Credential } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import {
  Button, ConfirmDialog, EmptyState, ErrorAlert, Field, Loading, Modal, PageHeader,
  TextInput, errorMessage,
} from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { formatDate } from '../../shared/format';

export const credentialsQuery = { queryKey: ['credentials'], queryFn: () => get<Credential[]>('/credentials') };

export default function CredentialsPage() {
  const { t, lang } = useI18n();
  const q = useQuery(credentialsQuery);
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Credential | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Credential | null>(null);
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
      {editing && <CredentialForm credential={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog danger title={t('credentials.deleteTitle')} message={t('credentials.deleteMessage', { name: deleting.name })}
          confirmLabel={t('common.delete')} busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />
      )}
    </section>
  );
}

function CredentialForm({ credential, onClose }: { credential: Credential | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(credential?.name ?? '');
  const [username, setUsername] = useState(credential?.username ?? '');
  const [password, setPassword] = useState('');
  const save = useMutation({
    mutationFn: () => credential
      ? put<Credential>('/credentials/' + credential.id, { name, username, password: password || null })
      : post<Credential>('/credentials', { name, username, password }),
    onSuccess: () => {
      toast.success(t('credentials.saved'));
      qc.invalidateQueries({ queryKey: ['credentials'] });
      onClose();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const fe = (save.error as { fieldErrors?: Record<string, string> } | null)?.fieldErrors ?? {};
  return (
    <Modal title={credential ? t('credentials.edit') : t('credentials.add')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <ErrorAlert error={save.error} />
        <Field label={t('common.name')} error={fe.name} required><TextInput value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} /></Field>
        <Field label={t('credentials.username')} error={fe.username} required><TextInput dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={150} /></Field>
        <Field
          label={credential ? t('credentials.newPassword') : t('credentials.password')} error={fe.password}
          hint={credential ? t('credentials.rotateHint') : t('credentials.passwordHint')} required={!credential}
        >
          <TextInput dir="ltr" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required={!credential} maxLength={512} />
        </Field>
        <div className="modalFooter inline">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" busy={save.isPending}>{t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
