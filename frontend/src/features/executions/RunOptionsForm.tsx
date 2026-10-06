import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { get } from '../../shared/api/client';
import type { Credential, Machine, RunOptions } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Field, Loading } from '../../shared/ui';

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
              <label key={m.id} className="check">
                <input type="checkbox" checked={value.machineIds.includes(m.id)} onChange={() => toggle(m.id)} />
                <span>{m.name} <small className="muted" dir="ltr">{m.hostname}:{m.sshPort}</small></span>
                {m.trustStatus !== 'TRUSTED' && <span className="badge warn">{t('status.' + m.trustStatus)}</span>}
              </label>
            ))}
          </div>
        )}
      </Field>
      {untrusted.length > 0 && (
        <div className="alert warn"><AlertTriangle size={16} /> {t('run.untrustedWarning', { names: untrusted.map((m) => m.name).join(', ') })}</div>
      )}
      <Field label={t('run.credential')} hint={t('run.credentialHint')}>
        <select value={value.credentialId ?? ''} onChange={(e) => onChange({ ...value, credentialId: e.target.value ? Number(e.target.value) : null })}>
          <option value="">{t('run.usePreferred')}</option>
          {(creds.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.username})</option>)}
        </select>
      </Field>
      {noCred.length > 0 && <div className="alert warn"><AlertTriangle size={16} /> {t('run.noCredentialWarning', { names: noCred.map((m) => m.name).join(', ') })}</div>}
      <div className="grid3">
        <Field label={t('run.mode')} hint={value.mode === 'MANUAL' ? t('run.manualHint') : t('run.automaticHint')}>
          <select value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value as RunOptions['mode'] })}>
            <option value="MANUAL">{t('run.manual')}</option>
            <option value="AUTOMATIC">{t('run.automatic')}</option>
          </select>
        </Field>
        <Field label={t('run.concurrency')} error={errors?.concurrency}>
          <select value={value.concurrency} onChange={(e) => onChange({ ...value, concurrency: Number(e.target.value) })}>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label={t('run.failurePolicy')}>
          <select value={value.failurePolicy} onChange={(e) => onChange({ ...value, failurePolicy: e.target.value as RunOptions['failurePolicy'] })}>
            <option value="STOP_NEW_MACHINES">{t('run.stopNew')}</option>
            <option value="CONTINUE">{t('run.continue')}</option>
          </select>
        </Field>
      </div>
    </div>
  );
}
