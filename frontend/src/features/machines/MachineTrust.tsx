import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { del, post } from '../../services/client';
import type { Discovery, Machine } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, Checkbox, Code, ErrorAlert, Modal } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
export function TrustBadge({ status }: { status: Machine['trustStatus'] }) {
  const { t } = useI18n();
  const icon = status === 'TRUSTED' ? <ShieldCheck size={14} /> : status === 'KEY_CHANGED' ? <ShieldAlert size={14} /> : <ShieldQuestion size={14} />;
  const tone = status === 'TRUSTED' ? 'ok' : status === 'KEY_CHANGED' ? 'bad' : 'warn';
  return <span className={'badge ' + tone}>{icon} {t('status.' + status)}</span>;
}

/** Server discovers the key; the user compares the fingerprint out-of-band and confirms; the server re-probes before storing. */
export function TrustDialog({ machine, onClose }: { machine: Machine; onClose: () => void }) {
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
