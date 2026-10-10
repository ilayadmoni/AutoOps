import { AlertTriangle, ArrowUpRight, Play, Save, Workflow as WorkflowIcon, X } from 'lucide-react';
import { Button, IconButton, TextInput, Tooltip } from '../../../components/ui';
import { useI18n } from '../../../app/providers/I18nProvider';
import { isDirty, type WorkspaceState } from './model';

/** Title, status badges and the explicit Save / Execute actions. Neither action is ever triggered by the assistant. */
export default function WorkspaceHead({ state, building, saving, onName, onSave, onExecute, onOpenBuilder, onClose }: {
  state: WorkspaceState;
  building: boolean;
  saving: boolean;
  onName: (name: string) => void;
  onSave: () => void;
  onExecute: () => void;
  onOpenBuilder: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const dirty = isDirty(state);
  const hasSteps = state.nodes.length > 0;
  const missing = state.missing.length;
  const canExecute = state.workflowId != null && !dirty && hasSteps && !building;
  return (
    <header className="previewHead workspaceHead">
      <span className="previewIcon"><WorkflowIcon size={16} /></span>
      <div className="previewTitle">
        <TextInput
          dir="auto" className="workspaceName" value={state.name} placeholder={t('ai.canvasTitle')}
          aria-label={t('common.name')} maxLength={200} onChange={(e) => onName(e.target.value)}
        />
        <small>{building ? t('ai.canvasBuilding') : t('ai.proposalNote')}</small>
      </div>
      <div className="workspaceBadges">
        {hasSteps && <span className="badge muted">{t('ai.stepCount', { n: state.nodes.length })}</span>}
        {missing > 0 && (
          <Tooltip text={t('ai.missing')}>
            <span className="badge warn" tabIndex={0}><AlertTriangle size={12} /> {t('ai.missingCount', { n: missing })}</span>
          </Tooltip>
        )}
        {hasSteps && (dirty
          ? <span className="badge warn">{t('workflows.unsaved')}</span>
          : <span className="badge ok">{t('workflows.savedBadge')}{state.version ? ` v${state.version}` : ''}</span>)}
      </div>
      <span className="grow" />
      <div className="workspaceActions">
        <Button small icon={<Save size={15} />} variant="primary" busy={saving} disabled={!hasSteps || building || (!dirty && state.workflowId != null)} onClick={onSave}>
          {t('common.save')}
        </Button>
        <Button
          small icon={<Play size={15} />} disabled={!canExecute} onClick={onExecute}
          hint={canExecute ? undefined : t('ai.saveToExecute')}
        >
          {t('workflows.run')}
        </Button>
        <IconButton label={t('ai.openInBuilder')} disabled={!hasSteps} onClick={onOpenBuilder}><ArrowUpRight size={16} /></IconButton>
        <IconButton label={t('ai.closeCanvas')} onClick={onClose}><X size={16} /></IconButton>
      </div>
    </header>
  );
}
