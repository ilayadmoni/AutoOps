import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '../../lib/apiClient';
import type { Machine } from '../../types/api';
import { Button, ErrorAlert, Field, Modal, NumberInput, Select, TextInput } from '../../components';
import { useCredentials } from '../../hooks/useCredentials';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/queryKeys';
import { machinesService, type MachineInput } from '../../services/machines';

export default function MachineFormModal({ machine, onClose }: { machine: Machine | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const creds = useCredentials();
  const [form, setForm] = useState<MachineInput>({
    name: machine?.name ?? '', hostname: machine?.hostname ?? '', sshPort: machine?.sshPort ?? 22,
    operatingSystem: machine?.operatingSystem ?? '', osVersion: machine?.osVersion ?? '', preferredCredentialId: machine?.preferredCredentialId ?? null,
  });
  const save = useMutation({
    mutationFn: () => (machine ? machinesService.update(machine.id, form) : machinesService.create(form)),
    onSuccess: () => { toast.success(t('machines.saved')); qc.invalidateQueries({ queryKey: queryKeys.machines }); onClose(); },
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
