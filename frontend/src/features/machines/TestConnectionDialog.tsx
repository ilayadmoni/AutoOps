import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Wifi } from 'lucide-react';
import type { Machine } from '../../types/api';
import { Button, ErrorAlert, Field, Modal, Select, StatusBadge } from '../../components';
import { useCredentials } from '../../hooks/useCredentials';
import { useI18n } from '../../hooks/useI18n';
import { machinesService } from '../../services/machines';
import { queryKeys } from '../../lib/queryKeys';

export default function TestConnectionDialog({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const creds = useCredentials();
  const [credentialId, setCredentialId] = useState<number | null>(machine.preferredCredentialId ?? null);
  const test = useMutation({
    mutationFn: () => machinesService.test(machine.id, credentialId),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.machines }),
  });
  const r = test.data;
  return (
    <Modal title={t('test.title', { name: machine.name })} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>{t('common.close')}</Button>
        <Button variant="primary" icon={<Wifi size={14} />} disabled={!credentialId} busy={test.isPending} onClick={() => test.mutate()}>{t('test.run')}</Button>
      </>
    }>
      <div className="stack">
        <Field label={t('run.credential')}>
          <Select
            block placeholder={t('test.selectCredential')}
            value={credentialId ?? ''}
            onChange={(e) => setCredentialId(e.target.value ? Number(e.target.value) : null)}
          options={(creds.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.username})` }))}
          />
        </Field>
        <ErrorAlert error={test.error} />
        {r && (
          <>
            <div className="checks">
              {(['ssh', 'hostVerification', 'authentication', 'os', 'sudo'] as const).map((k) => (
                <div key={k} className="checkItem"><span>{t('test.' + k)}</span><StatusBadge status={r[k]} /></div>
              ))}
            </div>
            <div className={'alert ' + (r.authentication === 'SUCCESS' && r.os === 'SUCCESS' ? 'ok' : 'warn')}>{r.message}</div>
          </>
        )}
      </div>
    </Modal>
  );
}
