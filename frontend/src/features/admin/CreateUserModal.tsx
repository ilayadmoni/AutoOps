import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ApiError } from '../../lib/apiClient';
import type { Role } from '../../types/api';
import { Button, ErrorAlert, Field, Modal, Select, TextInput } from '../../components';
import { useI18n } from '../../hooks/useI18n';
import { adminService } from '../../services/admin';

export default function CreateUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ username: '', password: '', role: 'USER' as Role });
  const save = useMutation({ mutationFn: () => adminService.createUser(form), onSuccess: () => { onDone(); onClose(); } });
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
