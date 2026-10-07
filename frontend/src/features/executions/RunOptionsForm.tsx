import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { get } from '../../shared/api/client';
import type { Credential, Machine, RunOptions } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Checkbox, Field, Loading, Segmented, Select } from '../../shared/ui';

export const machinesQuery = { queryKey: ['machines'], queryFn: () => get<Machine[]>('/machines') };

export const defaultRunOptions = (machineIds: number[] = []): RunOptions => ({
  machineIds, credentialId: null, mode: 'MANUAL', concurrency: 1, failurePolicy: 'STOP_NEW_MACHINES',
});

/** Machine/credential/mode/concurrency selection shared by command and workflow runs. */
export function RunOptionsForm({ value, onChange, errors }: { value: RunOptions; onChange: (v: RunOptions) => void; errors?: Record<string, string> }) {
  const { t } = useI18n();
  const machines = useQuery(machinesQuery);
  const creds = useQuery({ queryKey: ['credentials'], queryFn: () => get<Credential[]>('/credentials') });
  const toggle = (id: number) => onChange({ ...value, machineIds: value.machineIds.includes(id) ? value.machineIds.filter((x) => x !== id) : [...value.machineIds, id] });
  const selected = (machines.data ?? []).filter((m) => value.machineIds.includes(m.id));
  const untrusted = selected.filter((m) => m.trustStatus !== 'TRUSTED');
  const noCred = !value.credentialId ? selected.filter((m) => !m.preferredCredentialId) : [];
  return (
    <div className="stack">
      <Field label={t('run.machines')} error={errors?.machineIds}>
        {machines.isLoading ? <Loading /> : (
          <div className="checkList">
            {(machines.data ?? []).length === 0 && <span className="muted">{t('run.noMachines')}</span>}
            {(machines.data ?? []).map((m) => (
              <Checkbox
                key={m.id} boxed
                checked={value.machineIds.includes(m.id)}
                onChange={() => toggle(m.id)}
                label={(
                  <span className="checkRow">
                    <span className="truncate">{m.name}</span>
                    <small className="muted mono" dir="ltr">{m.hostname}:{m.sshPort}</small>
                    {m.trustStatus !== 'TRUSTED' && <span className="badge warn">{t('status.' + m.trustStatus)}</span>}
                  </span>
                )}
              />
            ))}
          </div>
        )}
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
