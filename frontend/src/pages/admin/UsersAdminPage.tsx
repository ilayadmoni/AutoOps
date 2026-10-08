import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import type { Role, UserView } from '../../types/api';
import {
  Button, ConfirmDialog, EmptyState, ErrorAlert, IconButton, Loading, PageHeader, Select, StatusBadge, errorMessage,
} from '../../components';
import CreateUserModal from '../../features/admin/CreateUserModal';
import ResetPasswordModal from '../../features/admin/ResetPasswordModal';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/queryKeys';
import { adminService } from '../../services/admin';
import { formatDate } from '../../utils/format';

export default function UsersAdminPage() {
  const { t, lang } = useI18n();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: queryKeys.admin.users, queryFn: adminService.users });
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<UserView | null>(null);
  const [deleting, setDeleting] = useState<UserView | null>(null);
  const done = (msg: string) => { toast.success(msg); qc.invalidateQueries({ queryKey: queryKeys.admin.users }); };
  const status = useMutation({
    mutationFn: (x: { id: number; status: UserView['status'] }) => adminService.setUserStatus(x.id, x.status),
    onSuccess: () => done(t('users.updated')), onError: (e) => toast.error(errorMessage(e)),
  });
  const role = useMutation({
    mutationFn: (x: { id: number; role: Role }) => adminService.setUserRole(x.id, x.role),
    onSuccess: () => done(t('users.updated')), onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: adminService.deleteUser,
    onSuccess: () => { setDeleting(null); done(t('users.deleted')); }, onError: (e) => { setDeleting(null); toast.error(errorMessage(e)); },
  });
  return (
    <section>
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle')}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>{t('users.create')}</Button>} />
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
                <td className="row gap">
                  <Button small onClick={() => status.mutate({ id: u.id, status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}>
                    {u.status === 'ACTIVE' ? t('users.disable') : t('users.enable')}
                  </Button>
                  <IconButton label={t('users.reset')} onClick={() => setResetting(u)}><KeyRound size={14} /></IconButton>
                  <IconButton danger label={t('common.delete')} disabled={u.id === me?.id} onClick={() => setDeleting(u)}><Trash2 size={14} /></IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {creating && <CreateUserModal onClose={() => setCreating(false)} onDone={() => done(t('users.createdToast'))} />}
      {resetting && <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />}
      {deleting && <ConfirmDialog danger title={t('users.deleteTitle')} message={t('users.deleteMessage', { name: deleting.username })} confirmLabel={t('common.delete')}
        busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
    </section>
  );
}
