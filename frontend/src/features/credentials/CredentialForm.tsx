import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post, put } from '../../services/client';
import type { Credential } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, ErrorAlert, Field, Modal, TextInput } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';

/** Secret input lives only in this form and is sent directly to the credential API, never to chat. */
export default function CredentialForm({ credential, initial, onClose, onSaved }: {
  credential: Credential | null;
  initial?: { name?: string; username?: string };
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(credential?.name ?? initial?.name ?? '');
  const [username, setUsername] = useState(credential?.username ?? initial?.username ?? '');
  const [password, setPassword] = useState('');
  const save = useMutation({
    mutationFn: () => credential
      ? put<Credential>('/credentials/' + credential.id, { name, username, password: password || null })
      : post<Credential>('/credentials', { name, username, password }),
    onSuccess: () => {
      setPassword('');
      toast.success(t('credentials.saved'));
      qc.invalidateQueries({ queryKey: ['credentials'] });
      onSaved?.();
      onClose();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!save.isPending) save.mutate();
  };
  const fe = (save.error as { fieldErrors?: Record<string, string> } | null)?.fieldErrors ?? {};
  return (
    <Modal title={credential ? t('credentials.edit') : t('credentials.add')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <ErrorAlert error={save.error} />
        <Field label={t('common.name')} error={fe.name} required><TextInput name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} /></Field>
        <Field label={t('credentials.username')} error={fe.username} required>
          <TextInput name="username" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={150} />
        </Field>
        <Field label={credential ? t('credentials.newPassword') : t('credentials.password')} error={fe.password}
          hint={credential ? t('credentials.rotateHint') : t('credentials.passwordHint')} required={!credential}>
          <TextInput name="password" dir="ltr" type="password" autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required={!credential} maxLength={512} />
        </Field>
        <div className="modalFooter inline">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" busy={save.isPending}>{t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
