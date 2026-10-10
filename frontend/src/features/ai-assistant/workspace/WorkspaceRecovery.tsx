import { AlertTriangle, MessageSquare, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui';
import { useI18n } from '../../../app/providers/I18nProvider';
import type { Failure } from './model';

/** Shown instead of an empty canvas: either the first generation failed, or the assistant is waiting for details. */
export default function WorkspaceRecovery({ failure, canRetry, retrying, onRetry }: {
  failure: Failure | null;
  canRetry: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  if (failure) {
    return (
      <div className="workspaceRecovery isError" role="alert">
        <AlertTriangle size={22} aria-hidden="true" />
        <strong>{t('ai.draftFailed')}</strong>
        <p>{failure.message}</p>
        <p className="muted">{t('ai.draftFailedHint')}</p>
        {canRetry && <Button variant="primary" icon={<RotateCcw size={15} />} busy={retrying} onClick={onRetry}>{t('ai.retry')}</Button>}
      </div>
    );
  }
  return (
    <div className="workspaceRecovery">
      <MessageSquare size={22} aria-hidden="true" />
      <strong>{t('ai.workspaceEmpty')}</strong>
      <p className="muted">{t('ai.workspaceEmptyHint')}</p>
    </div>
  );
}
