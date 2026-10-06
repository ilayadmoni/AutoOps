import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Pencil, Play, Plus, ShieldAlert, ShieldCheck, ShieldQuestion, Trash2, Wifi } from 'lucide-react';
import { ApiError, del, get, post, put } from '../../shared/api/client';
import type { Credential, Discovery, Machine, MachineTest } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Code, ConfirmDialog, EmptyState, ErrorAlert, Field, Loading, Modal, PageHeader, Spinner, StatusBadge, errorMessage } from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { formatDate } from '../../shared/format';
import { machinesQuery } from '../executions/RunOptionsForm';
import RunCommandModal from '../commands/RunCommandModal';

export default function MachinesPage() {
  const { t, lang } = useI18n();
  const q = useQuery(machinesQuery);
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Machine | 'new' | null>(null);
  const [trusting, setTrusting] = useState<Machine | null>(null);
  const [testing, setTesting] = useState<Machine | null>(null);
  const [running, setRunning] = useState<Machine | null>(null);
  const [deleting, setDeleting] = useState<Machine | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => del('/machines/' + id),
    onSuccess: () => { toast.success(t('machines.deleted')); setDeleting(null); qc.invalidateQueries({ queryKey: ['machines'] }); },
    onError: (e) => { toast.error(errorMessage(e)); setDeleting(null); },
  });
  return (
    <section>
      <PageHeader title={t('machines.title')} subtitle={t('machines.subtitle')}
        actions={<button className="btn primary" onClick={() => setEditing('new')}><Plus size={16} /> {t('machines.add')}</button>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('machines.empty')} hint={t('machines.emptyHint')} />
      ) : (
        <div className="cards">
          {q.data.map((m) => (
            <article className={'card machine ' + m.trustStatus.toLowerCase()} key={m.id}>
              <div className="row spread">
                <h3>{m.name}</h3>
                <TrustBadge status={m.trustStatus} />
              </div>
              <Code>{m.hostname}:{m.sshPort}</Code>
              <small className="muted">{[m.operatingSystem, m.osVersion].filter(Boolean).join(' ') || t('machines.osUnknown')}</small>
              {m.trustStatus === 'KEY_CHANGED' && <div className="alert danger small"><ShieldAlert size={16} /> {t('machines.keyChanged')}</div>}
              {m.sshFingerprint && <small className="muted fp" dir="ltr">{m.hostKeyAlgorithm} {m.sshFingerprint}</small>}
              {m.lastTestStatus && <small className="muted">{t('machines.lastTest')}: <StatusBadge status={m.lastTestStatus} /> {formatDate(m.lastTestedAt, lang)}</small>}
              <div className="row gap wrap">
                <button className="btn small" onClick={() => setTrusting(m)}><Fingerprint size={14} /> {m.trustStatus === 'TRUSTED' ? t('machines.reviewTrust') : t('machines.trust')}</button>
                <button className="btn small" onClick={() => setTesting(m)} disabled={m.trustStatus !== 'TRUSTED'}><Wifi size={14} /> {t('machines.test')}</button>
                <button className="btn small primary" onClick={() => setRunning(m)} disabled={m.trustStatus !== 'TRUSTED'} title={m.trustStatus !== 'TRUSTED' ? t('machines.trustFirst') : ''}><Play size={14} /> {t('machines.run')}</button>
                <button className="btn small ghost" onClick={() => setEditing(m)}><Pencil size={14} /></button>
                <button className="btn small ghost danger" onClick={() => setDeleting(m)}><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && <MachineForm machine={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {trusting && <TrustDialog machine={trusting} onClose={() => setTrusting(null)} />}
      {testing && <TestDialog machine={testing} onClose={() => setTesting(null)} />}
      {running && <RunCommandModal initial={{ machineIds: [running.id] }} onClose={() => setRunning(null)} />}
      {deleting && <ConfirmDialog danger title={t('machines.deleteTitle')} message={t('machines.deleteMessage', { name: deleting.name })}
        confirmLabel={t('common.delete')} busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
    </section>
  );
}

export function TrustBadge({ status }: { status: Machine['trustStatus'] }) {
  const { t } = useI18n();
  const icon = status === 'TRUSTED' ? <ShieldCheck size={14} /> : status === 'KEY_CHANGED' ? <ShieldAlert size={14} /> : <ShieldQuestion size={14} />;
  const tone = status === 'TRUSTED' ? 'ok' : status === 'KEY_CHANGED' ? 'bad' : 'warn';
  return <span className={'badge ' + tone}>{icon} {t('status.' + status)}</span>;
}

function MachineForm({ machine, onClose }: { machine: Machine | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const creds = useQuery({ queryKey: ['credentials'], queryFn: () => get<Credential[]>('/credentials') });
  const [form, setForm] = useState({
    name: machine?.name ?? '', hostname: machine?.hostname ?? '', sshPort: machine?.sshPort ?? 22,
    operatingSystem: machine?.operatingSystem ?? '', osVersion: machine?.osVersion ?? '', preferredCredentialId: machine?.preferredCredentialId ?? null as number | null,
  });
  const save = useMutation({
    mutationFn: () => machine ? put<Machine>('/machines/' + machine.id, form) : post<Machine>('/machines', form),
    onSuccess: () => { toast.success(t('machines.saved')); qc.invalidateQueries({ queryKey: ['machines'] }); onClose(); },
  });
  const fe = (save.error as ApiError | null)?.fieldErrors ?? {};
  const endpointChanged = machine && (machine.hostname !== form.hostname || machine.sshPort !== form.sshPort) && machine.trustStatus !== 'UNTRUSTED';
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <Modal title={machine ? t('machines.edit') : t('machines.add')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <ErrorAlert error={save.error} />
        <Field label={t('common.name')} error={fe.name}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={150} /></Field>
        <div className="grid2">
          <Field label={t('machines.hostname')} error={fe.hostname}><input dir="ltr" value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} required /></Field>
          <Field label={t('machines.port')} error={fe.sshPort}><input dir="ltr" type="number" min={1} max={65535} value={form.sshPort} onChange={(e) => setForm({ ...form, sshPort: Number(e.target.value) })} /></Field>
        </div>
        <div className="grid2">
          <Field label={t('machines.os')} hint={t('machines.osHint')}><input value={form.operatingSystem} onChange={(e) => setForm({ ...form, operatingSystem: e.target.value })} /></Field>
          <Field label={t('machines.osVersion')}><input dir="ltr" value={form.osVersion} onChange={(e) => setForm({ ...form, osVersion: e.target.value })} /></Field>
        </div>
        <Field label={t('machines.preferredCredential')} error={fe.preferredCredentialId}>
          <select value={form.preferredCredentialId ?? ''} onChange={(e) => setForm({ ...form, preferredCredentialId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{t('common.none')}</option>
            {(creds.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.username})</option>)}
          </select>
        </Field>
        {endpointChanged && <div className="alert warn">{t('machines.endpointResetsTrust')}</div>}
        <div className="modalFooter inline">
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={save.isPending}>{save.isPending && <Spinner />} {t('common.save')}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Server discovers the key; the user compares the fingerprint out-of-band and confirms; the server re-probes before storing. */
function TrustDialog({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [verified, setVerified] = useState(false);
  const discover = useMutation({ mutationFn: () => post<Discovery>(`/machines/${machine.id}/ssh-trust/discover`) });
  const confirm = useMutation({
    mutationFn: (fp: string) => post<Machine>(`/machines/${machine.id}/ssh-trust/confirm`, { expectedFingerprint: fp }),
    onSuccess: () => { toast.success(t('trust.confirmed')); qc.invalidateQueries({ queryKey: ['machines'] }); onClose(); },
  });
  const revoke = useMutation({
    mutationFn: () => del(`/machines/${machine.id}/ssh-trust`),
    onSuccess: () => { toast.success(t('trust.revoked')); qc.invalidateQueries({ queryKey: ['machines'] }); onClose(); },
  });
  const d = discover.data;
  const changed = d && machine.sshFingerprint && !d.matchesTrusted;
  return (
    <Modal title={t('trust.title', { name: machine.name })} onClose={onClose} footer={
      <>
        {machine.trustStatus !== 'UNTRUSTED' && <button className="btn danger ghost" onClick={() => revoke.mutate()} disabled={revoke.isPending}>{t('trust.revoke')}</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>{t('common.close')}</button>
        {d && !d.matchesTrusted && (
          <button className={'btn ' + (changed ? 'danger' : 'primary')} disabled={!verified || confirm.isPending} onClick={() => confirm.mutate(d.fingerprint)}>
            {confirm.isPending && <Spinner />} {changed ? t('trust.replace') : t('trust.confirm')}
          </button>
        )}
      </>
    }>
      <div className="stack">
        <p className="muted">{t('trust.explain')}</p>
        <div className="kv">
          <span>{t('machines.hostname')}</span><Code>{machine.hostname}:{machine.sshPort}</Code>
          <span>{t('trust.current')}</span><span><TrustBadge status={machine.trustStatus} /></span>
          {machine.sshFingerprint && <><span>{t('trust.trustedFingerprint')}</span><Code>{machine.hostKeyAlgorithm} {machine.sshFingerprint}</Code></>}
          {machine.mismatchFingerprint && <><span>{t('trust.presentedFingerprint')}</span><Code>{machine.mismatchFingerprint}</Code></>}
        </div>
        <ErrorAlert error={discover.error || confirm.error || revoke.error} />
        {!d ? (
          <button className="btn primary" onClick={() => discover.mutate()} disabled={discover.isPending}>{discover.isPending ? <Spinner /> : <Fingerprint size={14} />} {t('trust.discover')}</button>
        ) : d.matchesTrusted ? (
          <div className="alert ok"><ShieldCheck size={16} /> {t('trust.matches')}</div>
        ) : (
          <div className={'alert ' + (changed ? 'danger' : 'info')}>
            <div className="stack">
              {changed && <strong><ShieldAlert size={16} /> {t('trust.changedWarning')}</strong>}
              <span>{t('trust.discovered')}</span>
              <Code>{d.algorithm} {d.fingerprint}</Code>
              <small>{t('trust.verifyHint')} <Code>ssh-keygen -lf /etc/ssh/ssh_host_*_key.pub</Code></small>
              <label className="check"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> {t('trust.verifiedCheckbox')}</label>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function TestDialog({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const creds = useQuery({ queryKey: ['credentials'], queryFn: () => get<Credential[]>('/credentials') });
  const [credentialId, setCredentialId] = useState<number | null>(machine.preferredCredentialId ?? null);
  const test = useMutation({
    mutationFn: () => post<MachineTest>(`/machines/${machine.id}/test`, { credentialId, checkSudo: true }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['machines'] }),
  });
  const r = test.data;
  return (
    <Modal title={t('test.title', { name: machine.name })} onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>{t('common.close')}</button>
        <button className="btn primary" disabled={!credentialId || test.isPending} onClick={() => test.mutate()}>{test.isPending ? <Spinner /> : <Wifi size={14} />} {t('test.run')}</button>
      </>
    }>
      <div className="stack">
        <Field label={t('run.credential')}>
          <select value={credentialId ?? ''} onChange={(e) => setCredentialId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('test.selectCredential')}</option>
            {(creds.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.username})</option>)}
          </select>
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
