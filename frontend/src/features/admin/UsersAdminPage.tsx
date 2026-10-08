import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Trash2 } from 'lucide-react';
import { ApiError, del, get, patch, post } from '../../shared/api/client';
import type { Role, UserView } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import {
  Button, ConfirmDialog, EmptyState, ErrorAlert, errorMessage, Fab, Field, IconButton, Loading, Modal, PageHeader, Select, StatusBadge, TextInput,
} from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { formatDate } from '../../shared/format';

export default function UsersAdminPage() {
  const { t, lang } = useI18n();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'users'], queryFn: () => get<UserView[]>('/admin/users') });
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<UserView | null>(null);
  const [deleting, setDeleting] = useState<UserView | null>(null);
  const done = (msg: string) => { toast.success(msg); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); };
  const status = useMutation({
    mutationFn: (x: { id: number; status: string }) => patch<UserView>(`/admin/users/${x.id}/status`, { status: x.status }),
    onSuccess: () => done(t('users.updated')), onError: (e) => toast.error(errorMessage(e)),
  });
  const role = useMutation({
    mutationFn: (x: { id: number; role: Role }) => patch<UserView>(`/admin/users/${x.id}/role`, { role: x.role }),
    onSuccess: () => done(t('users.updated')), onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => del('/admin/users/' + id),
    onSuccess: () => { setDeleting(null); done(t('users.deleted')); }, onError: (e) => { setDeleting(null); toast.error(errorMessage(e)); },
  });
  return (
    <section>
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} />
      <Fab label={t('users.create')} onClick={() => setCreating(true)} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} /> : !q.data?.length ? <EmptyState title={t('users.empty')} /> : (
        <table className="table">
          <thead><tr><th>{t('login.username')}</th><th>{t('users.role')}</th><th>{t('common.status')}</th><th>{t('users.created')}</th><th /></tr></thead>
          <tbody>
            {q.data.map((u) => (
              <tr key={u.id}>
                <td dir="ltr">{u.username}{u.id === me?.id && <span className="badge info">{t('users.you')}</span>}</td>
                <td>
                  <Select
                    aria-label={t('users.role')} value={u.role}
                    onChange={(e) => role.mutate({ id: u.id, role: e.target.value as Role })}
                    options={[
                      { value: 'USER', label: t('role.USER') },
                      { value: 'ADMIN', label: t('role.ADMIN') },
                    ]}
                  />
                </td>
                <td><StatusBadge status={u.status} /></td>
                <td>{formatDate(u.createdAt, lang)}</td>
                <td className="actionsCell"><div className="row gap">
                  <Button small onClick={() => status.mutate({ id: u.id, status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}>
                    {u.status === 'ACTIVE' ? t('users.disable') : t('users.enable')}
                  </Button>
                  <IconButton label={t('users.reset')} onClick={() => setResetting(u)}><KeyRound size={14} /></IconButton>
                  <IconButton danger label={t('common.delete')} disabled={u.id === me?.id} onClick={() => setDeleting(u)}><Trash2 size={14} /></IconButton>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {creating && <CreateUser onClose={() => setCreating(false)} onDone={() => done(t('users.createdToast'))} />}
      {resetting && <ResetPassword user={resetting} onClose={() => setResetting(null)} />}
      {deleting && <ConfirmDialog danger title={t('users.deleteTitle')} message={t('users.deleteMessage', { name: deleting.username })} confirmLabel={t('common.delete')}
        busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
    </section>
  );
}

function CreateUser({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ username: '', password: '', role: 'USER' as Role });
  const save = useMutation({ mutationFn: () => post<UserView>('/admin/users', form), onSuccess: () => { onDone(); onClose(); } });
  const fe = (save.error as ApiError | null)?.fieldErrors ?? {};
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <Modal title={t('users.create')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <ErrorAlert error={save.error} />
        <Field label={t('login.username')} error={fe.username} hint={t('users.usernameHint')} required><TextInput dir="ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></Field>
        <Field label={t('users.tempPassword')} error={fe.password} hint={t('users.passwordHint')} required><TextInput dir="ltr" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} /></Field>
        <Field label={t('users.role')}>
          <Select
            block value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            options={[
              { value: 'USER', label: t('role.USER') },
              { value: 'ADMIN', label: t('role.ADMIN') },
            ]}
          />
        </Field>
        <div className="modalFooter inline">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" busy={save.isPending}>{t('users.create')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ user, onClose }: { user: UserView; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const save = useMutation({ mutationFn: () => post(`/admin/users/${user.id}/reset-password`, { password }), onSuccess: () => { toast.success(t('users.passwordReset')); onClose(); } });
  const fe = (save.error as ApiError | null)?.fieldErrors ?? {};
  return (
    <Modal title={t('users.resetTitle', { name: user.username })} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <ErrorAlert error={save.error} />
        <Field label={t('users.tempPassword')} error={fe.password} hint={t('users.resetHint')} required><TextInput dir="ltr" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} /></Field>
        <div className="modalFooter inline">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" busy={save.isPending}>{t('users.reset')}</Button>
        </div>
      </form>
    </Modal>
  );
}
