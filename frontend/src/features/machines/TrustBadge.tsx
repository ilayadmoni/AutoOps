import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { Machine } from '../../types/api';
import { useI18n } from '../../hooks/useI18n';

export default function TrustBadge({ status }: { status: Machine['trustStatus'] }) {
  const { t } = useI18n();
  const icon = status === 'TRUSTED' ? <ShieldCheck size={14} /> : status === 'KEY_CHANGED' ? <ShieldAlert size={14} /> : <ShieldQuestion size={14} />;
  const tone = status === 'TRUSTED' ? 'ok' : status === 'KEY_CHANGED' ? 'bad' : 'warn';
  return <span className={'badge ' + tone}>{icon} {t('status.' + status)}</span>;
}
