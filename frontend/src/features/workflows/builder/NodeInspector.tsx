import { Trash2, X } from 'lucide-react';
import type { Command, StoredFile, WorkflowNode } from '../../../shared/api/types';
import { Checkbox, Field, IconButton, NumberInput, Select, TextInput } from '../../../shared/ui';
import { CommandConfig, FileConfig, WaitConfig } from './StepConfigs';
import { STEP_ICON } from '../../../shared/ui/flow';
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

  const Icon = STEP_ICON[node.type as keyof typeof STEP_ICON];
  const others = nodes.filter((x) => x.key !== node.key);
  const paramErrors = Object.fromEntries(
    Object.entries(errors).filter(([k]) => k.startsWith('parameters.')).map(([k, v]) => [k.slice(11), v]),
  );

  return (
    <aside className="inspector" aria-label={t('steps.' + node.type, undefined, String(node.type))}>
      <div className="inspectorHead">
        <span className={'paletteIcon type-' + String(node.type).toLowerCase()}>{Icon && <Icon />}</span>
        <strong>{t('steps.' + node.type, undefined, String(node.type))}</strong>
        <IconButton label={t('common.delete')} danger onClick={onRemove}><Trash2 size={14} /></IconButton>
        <IconButton label={t('common.close')} onClick={onClose}><X size={16} /></IconButton>
      </div>
      <div className="inspectorBody">
        <Field label={t('common.name')} error={errors.name}>
          <TextInput value={node.name} onChange={(x) => onChange({ name: x.target.value })} maxLength={200} />
        </Field>
        <Field label={t('workflows.key')} error={errors.key} hint={t('workflows.keyHint')}>
          <TextInput dir="ltr" className="mono" value={node.key} disabled />
        </Field>

        {node.type === 'COMMAND' && <CommandConfig node={node} onChange={onChange} commands={commands} errors={errors} paramErrors={paramErrors} />}
        {node.type === 'FILE_TRANSFER' && <FileConfig node={node} onChange={onChange} files={files} errors={errors} />}
        {node.type === 'WAIT_UNTIL' && <WaitConfig node={node} onChange={onChange} commands={commands} errors={errors} paramErrors={paramErrors} />}

        <Field label={t('workflows.onSuccess')} error={errors.successNext}>
          <Select
            block placeholder={t('workflows.end')}
            value={node.successNext ?? ''}
            onChange={(x) => onChange({ successNext: x.target.value || null })}
            options={others.map((o) => ({ value: o.key, label: `${o.name} (${o.key})` }))}
          />
        </Field>
        <Field label={t('workflows.onFailure')} error={errors.failureNext}>
          <Select
            block placeholder={t('workflows.stop')}
            value={node.failureNext ?? ''}
            onChange={(x) => onChange({ failureNext: x.target.value || null })}
            options={others.map((o) => ({ value: o.key, label: `${o.name} (${o.key})` }))}
          />
        </Field>
        {errors.edges && <span className="fieldError">{errors.edges}</span>}

        <Checkbox
          boxed checked={!!node.requiresApproval}
          onChange={(x) => onChange({ requiresApproval: x.target.checked })}
          label={t('workflows.requireApproval')}
        />
        <Field label={t('workflows.timeout')} error={errors.timeoutSeconds}>
          <NumberInput
            min={1} max={3600} value={node.timeoutSeconds ?? ''}
            onValueChange={(timeoutSeconds) => onChange({ timeoutSeconds })}
          />
        </Field>
      </div>
    </aside>
  );
}
