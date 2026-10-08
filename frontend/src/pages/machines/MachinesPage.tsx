import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, MoreHorizontal, Pencil, Play, ShieldAlert, ShieldCheck, ShieldQuestion, Trash2, Wifi } from 'lucide-react';
import { ApiError, del, get, post, put } from '../../services/client';
import type { Credential, Discovery, Machine, MachineTest } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import {
  Button, Card, Checkbox, Code, ConfirmDialog, EmptyState, ErrorAlert, errorMessage, Fab, Field, IconButton, Loading, Menu, Modal, NumberInput, PageHeader, Select, StatusBadge, TextInput,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../utils/format';
import { machinesQuery } from '../../features/executions/RunOptionsForm';
import RunCommandModal from '../../features/commands/RunCommandModal';

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
      <PageHeader title={t('machines.title')} subtitle={t('machines.subtitle')} />
      <Fab label={t('machines.add')} onClick={() => setEditing('new')} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('machines.empty')} hint={t('machines.emptyHint')} />
      ) : (
        <div className="cards">
          {q.data.map((m) => (
            <Card className={'machine ' + m.trustStatus.toLowerCase()} key={m.id}>
              <div className="row spread">
                <h3>{m.name}</h3>
                <TrustBadge status={m.trustStatus} />
              </div>
              <Code>{m.hostname}:{m.sshPort}</Code>
              <small className="muted">{[m.operatingSystem, m.osVersion].filter(Boolean).join(' ') || t('machines.osUnknown')}</small>
              {m.trustStatus === 'KEY_CHANGED' && <div className="alert danger small"><ShieldAlert size={16} /> {t('machines.keyChanged')}</div>}
              {m.sshFingerprint && <small className="muted fp" dir="ltr">{m.hostKeyAlgorithm} {m.sshFingerprint}</small>}
              {m.lastTestStatus && <small className="muted">{t('machines.lastTest')}: <StatusBadge status={m.lastTestStatus} /> {formatDate(m.lastTestedAt, lang)}</small>}
              <div className="cardFoot">
                <Button small variant="primary" icon={<Play size={14} />} onClick={() => setRunning(m)} disabled={m.trustStatus !== 'TRUSTED'} hint={m.trustStatus !== 'TRUSTED' ? t('machines.trustFirst') : undefined}>{t('machines.run')}</Button>
                <Button small icon={<Fingerprint size={14} />} onClick={() => setTrusting(m)}>{m.trustStatus === 'TRUSTED' ? t('machines.reviewTrust') : t('machines.trust')}</Button>
                <span className="grow" />
                <IconButton label={t('machines.test')} hint={m.trustStatus !== 'TRUSTED' ? t('machines.trustFirst') : undefined} onClick={() => setTesting(m)} disabled={m.trustStatus !== 'TRUSTED'}><Wifi size={15} /></IconButton>
                <Menu
                  label={t('common.more')}
                  items={[
                    { key: 'edit', icon: <Pencil />, label: t('common.edit'), onSelect: () => setEditing(m) },
                    { key: 'delete', icon: <Trash2 />, label: t('common.delete'), danger: true, onSelect: () => setDeleting(m) },
                  ]}
                  trigger={<IconButton label={t('common.more')}><MoreHorizontal size={16} /></IconButton>}
                />
              </div>
            </Card>
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
        {machine.trustStatus !== 'UNTRUSTED' && <Button variant="danger" className="ghost" onClick={() => revoke.mutate()} busy={revoke.isPending}>{t('trust.revoke')}</Button>}
        <span className="grow" />
        <Button onClick={onClose}>{t('common.close')}</Button>
        {d && !d.matchesTrusted && (
          <Button variant={changed ? 'danger' : 'primary'} disabled={!verified} busy={confirm.isPending} onClick={() => confirm.mutate(d.fingerprint)}>
            {changed ? t('trust.replace') : t('trust.confirm')}
          </Button>
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
          <Button variant="primary" icon={<Fingerprint size={14} />} busy={discover.isPending} onClick={() => discover.mutate()}>{t('trust.discover')}</Button>
        ) : d.matchesTrusted ? (
          <div className="alert ok"><ShieldCheck size={16} /> {t('trust.matches')}</div>
        ) : (
          <div className={'alert ' + (changed ? 'danger' : 'info')}>
            <div className="stack">
              {changed && <strong><ShieldAlert size={16} /> {t('trust.changedWarning')}</strong>}
              <span>{t('trust.discovered')}</span>
              <Code>{d.algorithm} {d.fingerprint}</Code>
              <small>{t('trust.verifyHint')} <Code>ssh-keygen -lf /etc/ssh/ssh_host_*_key.pub</Code></small>
              <Checkbox checked={verified} onChange={(e) => setVerified(e.target.checked)} label={t('trust.verifiedCheckbox')} />
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
