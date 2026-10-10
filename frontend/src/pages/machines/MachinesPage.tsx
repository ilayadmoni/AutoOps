import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, MoreHorizontal, Pencil, Play, ShieldAlert, ShieldCheck, ShieldQuestion, Trash2 } from 'lucide-react';
import { del, post } from '../../services/client';
import type { Discovery, Machine } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import {
  Button, Card, Checkbox, Code, ConfirmDialog, EmptyState, ErrorAlert, errorMessage, Fab, IconButton, Loading, Menu, Modal, NoMatches, PageHeader, SearchToolbar, StatusBadge, useCollectionSearch,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../utils/format';
import { machinesQuery } from '../../features/executions/RunOptionsForm';
import RunCommandModal from '../../features/commands/RunCommandModal';
import MachineForm from '../../features/machines/MachineForm';

export default function MachinesPage() {
  const { t, lang } = useI18n();
  const q = useQuery(machinesQuery);
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Machine | 'new' | null>(null);
  const [trusting, setTrusting] = useState<Machine | null>(null);
  const [running, setRunning] = useState<Machine | null>(null);
  const [deleting, setDeleting] = useState<Machine | null>(null);
  const { query, setQuery, filtered: machines } = useCollectionSearch(q.data, (m) => [m.name, m.hostname, m.operatingSystem, m.osVersion]);
  const remove = useMutation({
    mutationFn: (id: number) => del('/machines/' + id),
    onSuccess: () => { toast.success(t('machines.deleted')); setDeleting(null); qc.invalidateQueries({ queryKey: ['machines'] }); },
    onError: (e) => { toast.error(errorMessage(e)); setDeleting(null); },
  });
  return (
    <section>
      <PageHeader title={t('machines.title')} subtitle={t('machines.subtitle')} />
      <Fab label={t('machines.add')} onClick={() => setEditing('new')} />
      {!!q.data?.length && <SearchToolbar value={query} onChange={setQuery} placeholder={t('machines.searchPlaceholder')} />}
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('machines.empty')} hint={t('machines.emptyHint')} />
      ) : !machines.length ? (
        <NoMatches title={t('machines.noMatch')} hint={t('machines.noMatchHint')} />
      ) : (
        <div className="cards">
          {machines.map((m) => (
            <Card className={'machine ' + m.trustStatus.toLowerCase()} key={m.id}>
              <div className="row spread">
                <h3>{m.name}</h3>
                <TrustBadge status={m.trustStatus} />
              </div>
              <div><Code>{m.hostname}:{m.sshPort}</Code></div>
              <small className="muted">{[m.operatingSystem, m.osVersion].filter(Boolean).join(' ') || t('machines.osUnknown')}</small>
              {m.trustStatus === 'KEY_CHANGED' && <div className="alert danger small"><ShieldAlert size={16} /> {t('machines.keyChanged')}</div>}
              {m.sshFingerprint && <small className="muted fp"><bdi dir="ltr">{m.hostKeyAlgorithm}</bdi><bdi dir="ltr" className="fpHash">{m.sshFingerprint}</bdi></small>}
              {m.lastTestStatus && <small className="muted lastTest">{t('machines.lastTest')}: <StatusBadge status={m.lastTestStatus} /> <bdi>{formatDate(m.lastTestedAt, lang)}</bdi></small>}
              <div className="cardFoot">
                <Button small variant="primary" icon={<Play size={14} />} onClick={() => setRunning(m)} disabled={m.trustStatus !== 'TRUSTED'} hint={m.trustStatus !== 'TRUSTED' ? t('machines.trustFirst') : undefined}>{t('machines.run')}</Button>
                <Button small icon={<Fingerprint size={14} />} onClick={() => setTrusting(m)}>{m.trustStatus === 'TRUSTED' ? t('machines.reviewTrust') : t('machines.trust')}</Button>
                <span className="grow" />
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
