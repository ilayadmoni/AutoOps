import { Fingerprint, Pencil, Play, ShieldAlert, Trash2, Wifi } from 'lucide-react';
import type { Machine } from '../../types/api';
import { Button, Card, Code, IconButton, StatusBadge } from '../../components';
import { useI18n } from '../../hooks/useI18n';
import { formatDate } from '../../utils/format';
import TrustBadge from './TrustBadge';

interface Props {
  machine: Machine;
  onTrust: () => void;
  onTest: () => void;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function MachineCard({ machine: m, onTrust, onTest, onRun, onEdit, onDelete }: Props) {
  const { t, lang } = useI18n();
  const trusted = m.trustStatus === 'TRUSTED';
  return (
    <Card className={'machine ' + m.trustStatus.toLowerCase()}>
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
        <Button small icon={<Fingerprint size={14} />} onClick={onTrust}>{trusted ? t('machines.reviewTrust') : t('machines.trust')}</Button>
        <Button small icon={<Wifi size={14} />} onClick={onTest} disabled={!trusted}>{t('machines.test')}</Button>
        <Button small variant="primary" icon={<Play size={14} />} onClick={onRun} disabled={!trusted} title={trusted ? '' : t('machines.trustFirst')}>{t('machines.run')}</Button>
        <span className="grow" />
        <IconButton label={t('common.edit')} onClick={onEdit}><Pencil size={14} /></IconButton>
        <IconButton danger label={t('common.delete')} onClick={onDelete}><Trash2 size={14} /></IconButton>
      </div>
    </Card>
  );
}
