import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, get, post, put } from '../../services/client';
import type { Credential, Machine } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, ErrorAlert, Field, Modal, NumberInput, Select, TextInput } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';

/** Values to prefill a new machine with, e.g. from an assistant proposal. */
export type MachineDraft = { name?: string; hostname?: string; sshPort?: number; operatingSystem?: string };

/** Add or edit a machine. `initial` prefills a new one; the user still picks a credential and saves. */
export default function MachineForm({ machine, initial, onClose, onSaved }: {
  machine: Machine | null;
  initial?: MachineDraft;
  onClose: () => void;
  onSaved?: (machine: Machine) => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const creds = useQuery({ queryKey: ['credentials'], queryFn: () => get<Credential[]>('/credentials') });
  const [form, setForm] = useState({
    name: machine?.name ?? initial?.name ?? '', hostname: machine?.hostname ?? initial?.hostname ?? '', sshPort: machine?.sshPort ?? initial?.sshPort ?? 22,
    operatingSystem: machine?.operatingSystem ?? initial?.operatingSystem ?? '', osVersion: machine?.osVersion ?? '', preferredCredentialId: machine?.preferredCredentialId ?? null as number | null,
  });
  const save = useMutation({
    mutationFn: () => machine ? put<Machine>('/machines/' + machine.id, form) : post<Machine>('/machines', form),
    onSuccess: (m) => { toast.success(t('machines.saved')); qc.invalidateQueries({ queryKey: ['machines'] }); onSaved?.(m); onClose(); },
  });
  const fe = (save.error as ApiError | null)?.fieldErrors ?? {};
  const endpointChanged = machine && (machine.hostname !== form.hostname || machine.sshPort !== form.sshPort) && machine.trustStatus !== 'UNTRUSTED';
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <Modal title={machine ? t('machines.edit') : t('machines.add')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <ErrorAlert error={save.error} />
        <Field label={t('common.name')} error={fe.name} required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={150} /></Field>
        <div className="fieldRow">
          <Field label={t('machines.hostname')} error={fe.hostname} required><TextInput dir="ltr" value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} required /></Field>
          <Field label={t('machines.port')} error={fe.sshPort}>
            <NumberInput min={1} max={65535} value={form.sshPort} onValueChange={(sshPort) => setForm({ ...form, sshPort })} />
          </Field>
        </div>
        <div className="fieldRow">
          <Field label={t('machines.os')} hint={t('machines.osHint')}><TextInput value={form.operatingSystem} onChange={(e) => setForm({ ...form, operatingSystem: e.target.value })} /></Field>
          <Field label={t('machines.osVersion')}><TextInput dir="ltr" value={form.osVersion} onChange={(e) => setForm({ ...form, osVersion: e.target.value })} /></Field>
        </div>
        <Field label={t('machines.preferredCredential')} error={fe.preferredCredentialId}>
          <Select
            block placeholder={t('common.none')}
            value={form.preferredCredentialId ?? ''}
            onChange={(e) => setForm({ ...form, preferredCredentialId: e.target.value ? Number(e.target.value) : null })}
          options={(creds.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.username})` }))}
          />
        </Field>
        {endpointChanged && <div className="alert warn">{t('machines.endpointResetsTrust')}</div>}
        <div className="modalFooter inline">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" busy={save.isPending}>{t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
