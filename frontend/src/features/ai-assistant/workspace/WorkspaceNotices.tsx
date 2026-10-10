import { AlertTriangle, Info } from 'lucide-react';
import { ApiError } from '../../../services/client';
import { Button, ErrorAlert } from '../../../components/ui';
import { useI18n } from '../../../app/providers/I18nProvider';
import type { WorkspaceState } from './model';

/** Everything the user needs to know before saving or running, beneath the canvas. */
export default function WorkspaceNotices({ state, stale, saveError, reloading, onReload, onApplyPending, onDismissPending }: {
  state: WorkspaceState;
  stale: boolean;
  saveError: unknown;
  reloading: boolean;
  onReload: () => void;
  onApplyPending: () => void;
  onDismissPending: () => void;
}) {
  const { t } = useI18n();
  const general = Object.values(state.errors._ ?? {});
  const invalid = Object.keys(state.errors).length > 0;
  const dirty = state.savedRevision !== state.revision;
  return (
    <footer className="workspaceNotices">
      {state.pending && (
        <div className="alert info" role="status">
          <Info size={16} />
          <span className="grow">{t('ai.pendingProposal')}</span>
          <Button small variant="primary" onClick={onApplyPending}>{t('ai.applyProposal')}</Button>
          <Button small variant="ghost" onClick={onDismissPending}>{t('ai.dismiss')}</Button>
        </div>
      )}
      {stale && (
        <div className="alert danger" role="alert">
          <span className="grow">{t('workflows.stale')}</span>
          <Button small busy={reloading} onClick={onReload}>{t('workflows.reload')}</Button>
        </div>
      )}
      {!stale && <ErrorAlert error={saveError as ApiError | null} />}
      {invalid && <div className="alert danger" role="alert"><AlertTriangle size={16} /> {general[0] ?? t('workflows.invalid')}</div>}
      {state.missing.length > 0 && (
        <div className="alert warn small" role="status">
          <AlertTriangle size={16} />
          <div>
            <strong>{t('ai.missing')}</strong>
            <ul>{state.missing.map((m, i) => <li key={i}>{m.message}</li>)}</ul>
          </div>
        </div>
      )}
      {state.nodes.length > 0 && dirty && state.workflowId != null && <p className="workspaceHint">{t('ai.saveToExecute')}</p>}
    </footer>
  );
}
