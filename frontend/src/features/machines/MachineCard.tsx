import { Fingerprint, MoreHorizontal, Pencil, Play, ShieldAlert, Trash2 } from 'lucide-react';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, Card, Checkbox, Code, IconButton, Menu, StatusBadge } from '../../components/ui';
import { formatDate } from '../../utils/format';
import type { Machine } from '../../types/api';
import { TrustBadge } from './MachineTrust';

export default function MachineCard({ machine: m, folderPath, onRun, onTrust, onEdit, onDelete, selected, selectionDisabled, onSelect }: {
  machine: Machine; folderPath?: string;
  onRun: () => void; onTrust: () => void; onEdit: () => void; onDelete: () => void;
  selected?: boolean; selectionDisabled?: boolean; onSelect?: () => void;
}) {
  const { t, lang } = useI18n();
  return <Card className={'machine ' + m.trustStatus.toLowerCase()}>
    <div className="row spread"><div className="machineCardTitle">
      {onSelect && <Checkbox aria-label={t('machinesBulk.selectMachine', { name: m.name })} checked={!!selected}
        disabled={selectionDisabled} onChange={onSelect} />}
      <h3>{m.name}</h3>
    </div><TrustBadge status={m.trustStatus} /></div>
    <div><Code>{m.hostname}:{m.sshPort}</Code></div>
    {folderPath && <small className="muted machineFolderPath"><bdi dir="ltr">{folderPath}</bdi></small>}
    <small className="muted">{[m.operatingSystem, m.osVersion].filter(Boolean).join(' ') || t('machines.osUnknown')}</small>
    {m.trustStatus === 'KEY_CHANGED' && <div className="alert danger small"><ShieldAlert size={16} /> {t('machines.keyChanged')}</div>}
    {m.sshFingerprint && <small className="muted fp"><bdi dir="ltr">{m.hostKeyAlgorithm}</bdi><bdi dir="ltr" className="fpHash">{m.sshFingerprint}</bdi></small>}
    {m.lastTestStatus && <small className="muted lastTest">{t('machines.lastTest')}: <StatusBadge status={m.lastTestStatus} /> <bdi>{formatDate(m.lastTestedAt, lang)}</bdi></small>}
    <div className="cardFoot">
      <Button small variant="primary" icon={<Play size={14} />} onClick={onRun} disabled={m.trustStatus !== 'TRUSTED'}
        hint={m.trustStatus !== 'TRUSTED' ? t('machines.trustFirst') : undefined}>{t('machines.run')}</Button>
      <Button small icon={<Fingerprint size={14} />} onClick={onTrust}>{m.trustStatus === 'TRUSTED' ? t('machines.reviewTrust') : t('machines.trust')}</Button>
      <Menu label={t('common.more')} items={[
        { key: 'edit', icon: <Pencil />, label: t('common.edit'), onSelect: onEdit },
        { key: 'delete', icon: <Trash2 />, label: t('common.delete'), danger: true, onSelect: onDelete },
      ]} trigger={<IconButton label={t('common.more')}><MoreHorizontal size={16} /></IconButton>} />
    </div>
  </Card>;
}
