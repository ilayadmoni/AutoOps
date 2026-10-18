import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlugZap, ShieldCheck } from 'lucide-react';
import { get, post } from '../../services/client';
import type { Credential, Machine, MachineTest } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, Code, ErrorAlert, Field, Modal, Select, StatusBadge } from '../../components/ui';
import { TrustBadge, TrustDialog } from './MachineTrust';

const CHECKS = ['ssh', 'hostVerification', 'authentication', 'os'] as const;

export default function MachineConnectionDialog({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const credentials = useQuery({ queryKey: ['credentials'], queryFn: () => get<Credential[]>('/credentials') });
  const [credentialId, setCredentialId] = useState<number | null>(machine.preferredCredentialId ?? null);
  const [reviewingIdentity, setReviewingIdentity] = useState(false);
  const test = useMutation({
    mutationFn: () => post<MachineTest>(`/machines/${machine.id}/test`, { credentialId, checkSudo: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['machines'] }),
  });
  const credential = credentials.data?.find(item => item.id === credentialId);
  const trusted = machine.trustStatus === 'TRUSTED';
  const success = test.data && CHECKS.every(check => test.data?.[check] === 'SUCCESS');

  if (reviewingIdentity) return <TrustDialog machine={machine} onClose={() => { setReviewingIdentity(false); test.reset(); }} />;
  return <Modal title={t('connection.title', { name: machine.name })} onClose={onClose} footer={<>
    <Button onClick={onClose}>{t('common.close')}</Button>
    <Button variant="primary" icon={<PlugZap size={16} />} disabled={!trusted || !credential || credentials.isError}
      busy={test.isPending} onClick={() => test.mutate()}>{t('test.run')}</Button>
  </>}>
    <div className="stack">
      <p className="muted">{t('connection.explain')}</p>
      <div className="kv">
        <span>{t('machines.hostname')}</span><Code>{machine.hostname}:{machine.sshPort}</Code>
        <span>{t('trust.current')}</span><span><TrustBadge status={machine.trustStatus} /></span>
      </div>
      <ErrorAlert error={credentials.error} onRetry={() => credentials.refetch()} />
      <Field label={t('test.selectCredential')} required>
        <Select block value={credentialId ?? ''} disabled={test.isPending || credentials.isPending}
          placeholder={t('connection.unassigned')}
          options={(credentials.data ?? []).map(item => ({ value: item.id, label: `${item.name} (${item.username})` }))}
          onChange={event => { setCredentialId(event.target.value ? Number(event.target.value) : null); test.reset(); }} />
      </Field>
      {credential && <small className="muted">{t('connection.username')}: <bdi dir="ltr">{credential.username}</bdi></small>}
      {!trusted && <p className={'alert ' + (machine.trustStatus === 'KEY_CHANGED' ? 'danger' : 'info')}>
        {t(machine.trustStatus === 'KEY_CHANGED' ? 'connection.identityChanged' : 'connection.identityRequired')}
      </p>}
      <Button small variant="ghost" icon={<ShieldCheck size={16} />} disabled={test.isPending}
        onClick={() => setReviewingIdentity(true)}>{t('connection.identity')}</Button>
      <ErrorAlert error={test.error} />
      {test.data && <div className="stack" role="status">
        <p className={'alert ' + (success ? 'ok' : 'danger')}>{t(success ? 'connection.success' : 'connection.failed')}</p>
        <div className="kv">{CHECKS.map(check => <Fragment key={check}>
          <span>{t('test.' + check)}</span><span><StatusBadge status={test.data![check]} /></span>
        </Fragment>)}</div>
        {test.data.message && <small className="muted" dir="auto">{test.data.message}</small>}
      </div>}
    </div>
  </Modal>;
}
