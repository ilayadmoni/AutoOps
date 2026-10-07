import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import type { Risk } from '../api/types';

/** Status to tone. Keeping this in one table is what makes state colour mean the same thing everywhere. */
const STATUS_TONE: Record<string, string> = {
  SUCCESS: 'ok', APPROVED: 'ok', TRUSTED: 'ok', COMPLETED: 'ok', ACTIVE: 'ok',
  FAILED: 'bad', REJECTED: 'bad', KEY_CHANGED: 'bad', MISMATCH: 'bad', DISABLED: 'bad',
  PARTIAL: 'warn', WAITING_APPROVAL: 'warn', PENDING: 'warn', READY_FOR_REVIEW: 'warn',
  UNTRUSTED: 'warn', WARNING: 'warn', EXPIRED: 'muted',
  RUNNING: 'info', PREFLIGHT: 'info', ANALYZING: 'info', IMPORTING: 'info', UPLOADED: 'info',
  CANCELLED: 'muted', SKIPPED: 'muted', NOT_CHECKED: 'muted', NOT_REQUIRED: 'muted',
};

export function StatusBadge({ status }: { status?: string | null }) {
  const { t } = useI18n();
  if (!status) return <span className="badge muted">{t('common.notSet')}</span>;
  return <span className={'badge ' + (STATUS_TONE[status] ?? 'muted')}>{t('status.' + status, undefined, status)}</span>;
}

/** High risk also carries an icon, so risk is never signalled by colour alone. */
export function RiskBadge({ risk }: { risk?: Risk | string | null }) {
  const { t } = useI18n();
  if (!risk) return null;
  const tone = risk === 'HIGH' ? 'bad' : risk === 'MEDIUM' ? 'warn' : 'ok';
  return (
    <span className={'badge risk ' + tone}>
      {risk === 'HIGH' && <AlertTriangle size={12} />}
      {t('risk.' + risk)}
    </span>
  );
}
