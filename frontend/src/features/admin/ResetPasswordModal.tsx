import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ApiError } from '../../lib/apiClient';
import type { UserView } from '../../types/api';
import { Button, ErrorAlert, Field, Modal, TextInput } from '../../components';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { adminService } from '../../services/admin';

export default function ResetPasswordModal({ user, onClose }: { user: UserView; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const save = useMutation({ mutationFn: () => adminService.resetPassword(user.id, password), onSuccess: () => { toast.success(t('users.passwordReset')); onClose(); } });
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
