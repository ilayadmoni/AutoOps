import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { get } from '../../services/client';
import type { Credential, RunOptions } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { Field, Segmented, Select } from '../../components/ui';
import MachineFolderPicker from './MachineFolderPicker';

import { machinesQuery } from './runOptions';
export { machinesQuery, defaultRunOptions } from './runOptions';

/** Machine/credential/mode/concurrency selection shared by command and workflow runs. */
export function RunOptionsForm({ value, onChange, errors, historyWorkflowId }: {
  value: RunOptions; onChange: (v: RunOptions) => void; errors?: Record<string, string>; historyWorkflowId?: number;
}) {
  const { t } = useI18n();
  const machines = useQuery(machinesQuery);
  const creds = useQuery({ queryKey: ['credentials'], queryFn: () => get<Credential[]>('/credentials') });
  const selected = (machines.data ?? []).filter((m) => value.machineIds.includes(m.id));
  const untrusted = selected.filter((m) => m.trustStatus !== 'TRUSTED');
  const noCred = !value.credentialId ? selected.filter((m) => !m.preferredCredentialId) : [];
  return (
    <div className="stack">
      <Field label={t('run.machines')} error={errors?.machineIds}>
        <MachineFolderPicker selected={value.machineIds} onChange={machineIds => onChange({ ...value, machineIds })} historyWorkflowId={historyWorkflowId} />
      </Field>
      {untrusted.length > 0 && (
        <div className="alert warn"><AlertTriangle size={16} /> {t('run.untrustedWarning', { names: untrusted.map((m) => m.name).join(', ') })}</div>
      )}
      <Field label={t('run.credential')} hint={t('run.credentialHint')}>
        <Select
          block placeholder={t('run.usePreferred')}
          value={value.credentialId ?? ''}
          onChange={(e) => onChange({ ...value, credentialId: e.target.value ? Number(e.target.value) : null })}
          options={(creds.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.username})` }))}
        />
      </Field>
      {noCred.length > 0 && <div className="alert warn"><AlertTriangle size={16} /> {t('run.noCredentialWarning', { names: noCred.map((m) => m.name).join(', ') })}</div>}
      <div className="fieldRow">
        <Field label={t('run.mode')} hint={value.mode === 'MANUAL' ? t('run.manualHint') : t('run.automaticHint')}>
          <Select
            block value={value.mode}
            onChange={(e) => onChange({ ...value, mode: e.target.value as RunOptions['mode'] })}
            options={[
              { value: 'MANUAL', label: t('run.manual') },
              { value: 'AUTOMATIC', label: t('run.automatic') },
            ]}
          />
        </Field>
        <Field label={t('run.failurePolicy')}>
          <Select
            block value={value.failurePolicy}
            onChange={(e) => onChange({ ...value, failurePolicy: e.target.value as RunOptions['failurePolicy'] })}
            options={[
              { value: 'STOP_NEW_MACHINES', label: t('run.stopNew') },
              { value: 'CONTINUE', label: t('run.continue') },
            ]}
          />
        </Field>
      </div>
      {/* Three short numeric choices: a segmented control shows all of them without opening a menu. */}
      <Field label={t('run.concurrency')} error={errors?.concurrency}>
        <Segmented
          label={t('run.concurrency')}
          value={String(value.concurrency)}
          onChange={(n) => onChange({ ...value, concurrency: Number(n) })}
          options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))}
        />
      </Field>
    </div>
  );
}
