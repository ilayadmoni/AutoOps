import { Trash2, X } from 'lucide-react';
import type { Command, StoredFile, WorkflowNode } from '../../../shared/api/types';
import { Field, IconButton } from '../../../shared/ui';
import { CommandConfig, FileConfig, WaitConfig } from './StepConfigs';
import { useI18n } from '../../../i18n/I18nProvider';

/** Right-hand drawer holding the selected step's full configuration. */
export default function NodeInspector({ node, nodes, errors, commands, files, onChange, onRemove, onClose }: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  errors: Record<string, string>;
  commands: Command[];
  files: StoredFile[];
  onChange: (patch: Partial<WorkflowNode>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const others = nodes.filter((x) => x.key !== node.key);
  const paramErrors = Object.fromEntries(
    Object.entries(errors).filter(([k]) => k.startsWith('parameters.')).map(([k, v]) => [k.slice(11), v]),
  );

  return (
    <aside className="inspector">
      <div className="inspectorHead">
        <strong>{t('steps.' + node.type, undefined, String(node.type))}</strong>
        <IconButton label={t('common.delete')} danger onClick={onRemove}><Trash2 size={14} /></IconButton>
        <IconButton label={t('common.cancel')} onClick={onClose}><X size={16} /></IconButton>
      </div>
      <div className="inspectorBody">
        <Field label={t('common.name')} error={errors.name}>
          <input value={node.name} onChange={(x) => onChange({ name: x.target.value })} maxLength={200} />
        </Field>
        <Field label={t('workflows.key')} error={errors.key}>
          <input dir="ltr" value={node.key} disabled />
        </Field>

        {node.type === 'COMMAND' && <CommandConfig node={node} onChange={onChange} commands={commands} errors={errors} paramErrors={paramErrors} />}
        {node.type === 'FILE_TRANSFER' && <FileConfig node={node} onChange={onChange} files={files} errors={errors} />}
        {node.type === 'WAIT_UNTIL' && <WaitConfig node={node} onChange={onChange} commands={commands} errors={errors} paramErrors={paramErrors} />}

        <Field label={t('workflows.onSuccess')} error={errors.successNext}>
          <select value={node.successNext ?? ''} onChange={(x) => onChange({ successNext: x.target.value || null })}>
            <option value="">{t('workflows.end')}</option>
            {others.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.key})</option>)}
          </select>
        </Field>
        <Field label={t('workflows.onFailure')} error={errors.failureNext}>
          <select value={node.failureNext ?? ''} onChange={(x) => onChange({ failureNext: x.target.value || null })}>
            <option value="">{t('workflows.stop')}</option>
            {others.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.key})</option>)}
          </select>
        </Field>
        {errors.edges && <span className="fieldError">{errors.edges}</span>}

        <label className="check">
          <input type="checkbox" checked={!!node.requiresApproval} onChange={(x) => onChange({ requiresApproval: x.target.checked })} />
          {t('workflows.requireApproval')}
        </label>
        <Field label={t('workflows.timeout')} error={errors.timeoutSeconds}>
          <input type="number" min={1} max={3600} value={node.timeoutSeconds ?? ''} onChange={(x) => onChange({ timeoutSeconds: Number(x.target.value) })} />
        </Field>
      </div>
    </aside>
  );
}
