import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '../../lib/apiClient';
import type { Credential } from '../../types/api';
import { Button, ErrorAlert, Field, Modal, TextInput } from '../../components';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/queryKeys';
import { credentialsService } from '../../services/credentials';

export default function CredentialFormModal({ credential, onClose }: { credential: Credential | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(credential?.name ?? '');
  const [username, setUsername] = useState(credential?.username ?? '');
  const [password, setPassword] = useState('');
  const save = useMutation({
    mutationFn: () => (credential
      ? credentialsService.update(credential.id, { name, username, password: password || null })
      : credentialsService.create({ name, username, password })),
    onSuccess: () => {
      toast.success(t('credentials.saved'));
      qc.invalidateQueries({ queryKey: queryKeys.credentials });
      onClose();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const fe = (save.error as ApiError | null)?.fieldErrors ?? {};
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
