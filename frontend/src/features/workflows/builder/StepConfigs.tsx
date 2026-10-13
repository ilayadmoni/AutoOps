import { useState } from 'react';
import { FileUp, Plus } from 'lucide-react';
import type { Command, StoredFile, WorkflowNode } from '../../../types/api';
import {
  Button, Checkbox, Field, FilePicker, NumberInput, Segmented, Select, Textarea, TextInput,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/Toast';
import { ParameterInputs } from '../../commands/ParameterInputs';
import CreateCommandModal from '../../commands/CreateCommandModal';
import CommandSearch from '../../commands/CommandSearch';
import { useUpload } from '../../../pages/files/FilesPage';
import { useI18n } from '../../../app/providers/I18nProvider';

type ConfigProps = {
  node: WorkflowNode;
  onChange: (patch: Partial<WorkflowNode>) => void;
  errors: Record<string, string>;
};

export function CommandSelect({ value, onChange, commands, lowOnly, error }: {
  value?: number | null; onChange: (id: number | null) => void; commands: Command[]; lowOnly?: boolean; error?: string;
}) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <CommandSearch commands={commands} value={value} onChange={onChange} error={error} lowOnly={lowOnly} />
      <Button small variant="ghost" icon={<Plus size={14} />} className="selfStart" onClick={() => setCreating(true)}>{t('commands.create')}</Button>
      {creating && <CreateCommandModal onClose={() => setCreating(false)} onCreated={(c) => onChange(c.id)} />}
    </>
  );
}

export function CommandConfig({ node, onChange, commands, errors, paramErrors }: ConfigProps & {
  commands: Command[]; paramErrors: Record<string, string>;
}) {
  const { t } = useI18n();
  const cmd = commands.find((c) => c.id === node.commandDefinitionId);
  // A step runs either a Command Bank entry or its own command; `customCommand !== null/undefined` selects the latter.
  const custom = node.customCommand != null;
  return (
    <>
      <Segmented
        label={t('run.command')}
        value={custom ? 'custom' : 'bank'}
        options={[{ value: 'bank', label: t('workflows.fromBank') }, { value: 'custom', label: t('workflows.customCommand') }]}
        onChange={(mode) => onChange(mode === 'custom'
          ? { customCommand: cmd?.commandTemplate.includes('{{') ? '' : cmd?.commandTemplate ?? '', commandDefinitionId: null, parameters: {} }
          : { customCommand: null })}
      />
      {custom ? (
        <Field label={t('workflows.customCommand')} error={errors.customCommand} hint={t('workflows.customCommandHint')}>
          <Textarea
            dir="ltr" className="mono" rows={3} maxLength={4000} spellCheck={false}
            placeholder="docker compose down" value={node.customCommand ?? ''}
            onChange={(e) => onChange({ customCommand: e.target.value })}
          />
        </Field>
      ) : (
        <>
          <CommandSelect
            value={node.commandDefinitionId}
            onChange={(id) => onChange({ commandDefinitionId: id, parameters: {} })}
            commands={commands}
            error={errors.commandDefinitionId}
          />
          {cmd && <ParameterInputs specs={cmd.parameters} values={node.parameters ?? {}} onChange={(p) => onChange({ parameters: p })} errors={paramErrors} />}
        </>
      )}
      <Checkbox checked={!!node.runWithSudo} onChange={(x) => onChange({ runWithSudo: x.target.checked })} label={t('run.sudo')} />
    </>
  );
}

export function FileConfig({ node, onChange, files, errors }: ConfigProps & { files: StoredFile[] }) {
  const { t } = useI18n();
  const up = useUpload();
  const toast = useToast();
  return (
    <>
      <Field label={t('workflows.file')} error={errors.storedFileId}>
        <Select
          block placeholder={t('workflows.selectFile')}
          value={node.storedFileId ?? ''}
          onChange={(x) => onChange({ storedFileId: x.target.value ? Number(x.target.value) : null })}
          options={files.map((f) => ({ value: f.id, label: `${f.filename} (${f.checksum.slice(0, 8)})` }))}
        />
      </Field>
      <FilePicker onPick={(f) => {
        if (!f) return;
        up.mutate(f, {
          onSuccess: (saved) => { onChange({ storedFileId: saved.id }); toast.success(t('files.uploaded', { name: saved.filename })); },
          onError: (err) => toast.error(err.message),
        });
      }}>
        {(open) => <Button small busy={up.isPending} icon={<FileUp size={14} />} onClick={open}>{t('files.upload')}</Button>}
      </FilePicker>
      <Field label={t('workflows.destination')} error={errors.destinationPath} hint={t('workflows.destinationHint')}>
        <TextInput dir="ltr" value={node.destinationPath ?? ''} onChange={(x) => onChange({ destinationPath: x.target.value })} />
      </Field>
      <div className="row gap wrap">
        <Checkbox checked={!!node.overwrite} onChange={(x) => onChange({ overwrite: x.target.checked })} label={t('workflows.overwrite')} />
        <Checkbox checked={!!node.useSudo} onChange={(x) => onChange({ useSudo: x.target.checked })} label={t('workflows.privileged')} />
      </div>
    </>
  );
}

export function WaitConfig({ node, onChange, commands, errors, paramErrors }: ConfigProps & {
  commands: Command[]; paramErrors: Record<string, string>;
}) {
  const { t } = useI18n();
  const usesCommand = node.checkType === 'OUTPUT_CONTAINS' || node.checkType === 'EXIT_CODE';
  const cmd = commands.find((c) => c.id === node.commandDefinitionId);
  return (
    <>
      <Field label={t('workflows.checkType')} error={errors.checkType}>
        <Select
          block value={node.checkType ?? ''}
          onChange={(x) => onChange({ checkType: x.target.value as WorkflowNode['checkType'] })}
          options={(['SERVICE_ACTIVE', 'FILE_EXISTS', 'OUTPUT_CONTAINS', 'EXIT_CODE'] as const).map((c) => ({ value: c, label: t('checks.' + c) }))}
        />
      </Field>
      {usesCommand ? (
        <>
          <CommandSelect
            lowOnly
            value={node.commandDefinitionId}
            onChange={(id) => onChange({ commandDefinitionId: id, parameters: {} })}
            commands={commands}
            error={errors.commandDefinitionId}
          />
          {cmd && <ParameterInputs specs={cmd.parameters} values={node.parameters ?? {}} onChange={(p) => onChange({ parameters: p })} errors={paramErrors} />}
          {node.checkType === 'OUTPUT_CONTAINS' ? (
            <Field label={t('workflows.expectedOutput')} error={errors.expectedOutput}>
              <TextInput dir="ltr" value={node.expectedOutput ?? ''} onChange={(x) => onChange({ expectedOutput: x.target.value })} />
            </Field>
          ) : (
            <Field label={t('workflows.expectedExitCode')} error={errors.expectedExitCode}>
              <NumberInput min={0} max={255} value={node.expectedExitCode ?? 0} onValueChange={(expectedExitCode) => onChange({ expectedExitCode })} />
            </Field>
          )}
        </>
      ) : (
        <Field label={node.checkType === 'FILE_EXISTS' ? t('workflows.filePath') : t('workflows.serviceName')} error={errors.target}>
          <TextInput
            dir="ltr"
            value={node.target ?? ''}
            onChange={(x) => onChange({ target: x.target.value })}
            placeholder={node.checkType === 'FILE_EXISTS' ? '/etc/app/ready' : 'nginx'}
          />
        </Field>
      )}
      <div className="row gap wrap">
        <Field label={t('workflows.interval')} error={errors.intervalSeconds}>
          <NumberInput min={1} max={300} value={node.intervalSeconds ?? 5} onValueChange={(intervalSeconds) => onChange({ intervalSeconds })} />
        </Field>
        <Checkbox checked={!!node.runWithSudo} onChange={(x) => onChange({ runWithSudo: x.target.checked })} label={t('run.sudo')} />
      </div>
    </>
  );
}
