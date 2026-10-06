import { useRef } from 'react';
import { FileUp } from 'lucide-react';
import type { Command, StoredFile, WorkflowNode } from '../../../shared/api/types';
import { Button, Code, Field, RiskBadge, StatusBadge } from '../../../shared/ui';
import { useToast } from '../../../shared/ui/Toast';
import { ParameterInputs } from '../../commands/ParameterInputs';
import { useUpload } from '../../files/FilesPage';
import { useI18n } from '../../../i18n/I18nProvider';

type ConfigProps = {
  node: WorkflowNode;
  onChange: (patch: Partial<WorkflowNode>) => void;
  errors: Record<string, string>;
};

export function CommandSelect({ value, onChange, commands, lowOnly, error }: {
  value?: number | null; onChange: (id: number | null) => void; commands: Command[]; lowOnly?: boolean; error?: string;
}) {
  const { t } = useI18n();
  const usable = commands.filter((c) => c.status !== 'REJECTED' && (!lowOnly || c.riskLevel === 'LOW'));
  const selected = commands.find((c) => c.id === value);
  return (
    <>
      <Field label={t('run.command')} error={error}>
        <select value={value ?? ''} onChange={(x) => onChange(x.target.value ? Number(x.target.value) : null)}>
          <option value="">{t('run.selectCommand')}</option>
          {usable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} [{t('risk.' + c.riskLevel)}]{c.status !== 'APPROVED' ? ' — ' + t('status.' + c.status) : ''}
            </option>
          ))}
        </select>
      </Field>
      {selected && (
        <div className="row gap wrap">
          <Code>{selected.commandTemplate}</Code>
          <RiskBadge risk={selected.riskLevel} />
          {selected.status !== 'APPROVED' && <StatusBadge status={selected.status} />}
        </div>
      )}
    </>
  );
}

export function CommandConfig({ node, onChange, commands, errors, paramErrors }: ConfigProps & {
  commands: Command[]; paramErrors: Record<string, string>;
}) {
  const { t } = useI18n();
  const cmd = commands.find((c) => c.id === node.commandDefinitionId);
  return (
    <>
      <CommandSelect
        value={node.commandDefinitionId}
        onChange={(id) => onChange({ commandDefinitionId: id, parameters: {} })}
        commands={commands}
        error={errors.commandDefinitionId}
      />
      {cmd && <ParameterInputs specs={cmd.parameters} values={node.parameters ?? {}} onChange={(p) => onChange({ parameters: p })} errors={paramErrors} />}
      <label className="check">
        <input type="checkbox" checked={!!node.runWithSudo} onChange={(x) => onChange({ runWithSudo: x.target.checked })} /> {t('run.sudo')}
      </label>
    </>
  );
}

export function FileConfig({ node, onChange, files, errors }: ConfigProps & { files: StoredFile[] }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const up = useUpload();
  const toast = useToast();
  return (
    <>
      <Field label={t('workflows.file')} error={errors.storedFileId}>
        <select value={node.storedFileId ?? ''} onChange={(x) => onChange({ storedFileId: x.target.value ? Number(x.target.value) : null })}>
          <option value="">{t('workflows.selectFile')}</option>
          {files.map((f) => <option key={f.id} value={f.id}>{f.filename} ({f.checksum.slice(0, 8)})</option>)}
        </select>
      </Field>
      <input
        ref={input}
        type="file"
        hidden
        onChange={(x) => {
          const f = x.target.files?.[0];
          x.target.value = '';
          if (!f) return;
          up.mutate(f, {
            onSuccess: (s) => { onChange({ storedFileId: s.id }); toast.success(t('files.uploaded', { name: s.filename })); },
            onError: (err) => toast.error(err.message),
          });
        }}
      />
      <Button small busy={up.isPending} icon={<FileUp size={14} />} onClick={() => input.current?.click()}>
        {t('files.upload')}
      </Button>
      <Field label={t('workflows.destination')} error={errors.destinationPath} hint={t('workflows.destinationHint')}>
        <input dir="ltr" value={node.destinationPath ?? ''} onChange={(x) => onChange({ destinationPath: x.target.value })} />
      </Field>
      <div className="row gap wrap">
        <label className="check">
          <input type="checkbox" checked={!!node.overwrite} onChange={(x) => onChange({ overwrite: x.target.checked })} /> {t('workflows.overwrite')}
        </label>
        <label className="check">
          <input type="checkbox" checked={!!node.useSudo} onChange={(x) => onChange({ useSudo: x.target.checked })} /> {t('workflows.privileged')}
        </label>
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
        <select value={node.checkType ?? ''} onChange={(x) => onChange({ checkType: x.target.value as WorkflowNode['checkType'] })}>
          {(['SERVICE_ACTIVE', 'FILE_EXISTS', 'OUTPUT_CONTAINS', 'EXIT_CODE'] as const).map((c) => (
            <option key={c} value={c}>{t('checks.' + c)}</option>
          ))}
        </select>
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
              <input dir="ltr" value={node.expectedOutput ?? ''} onChange={(x) => onChange({ expectedOutput: x.target.value })} />
            </Field>
          ) : (
            <Field label={t('workflows.expectedExitCode')} error={errors.expectedExitCode}>
              <input type="number" min={0} max={255} value={node.expectedExitCode ?? 0} onChange={(x) => onChange({ expectedExitCode: Number(x.target.value) })} />
            </Field>
          )}
        </>
      ) : (
        <Field label={node.checkType === 'FILE_EXISTS' ? t('workflows.filePath') : t('workflows.serviceName')} error={errors.target}>
          <input
            dir="ltr"
            value={node.target ?? ''}
            onChange={(x) => onChange({ target: x.target.value })}
            placeholder={node.checkType === 'FILE_EXISTS' ? '/etc/app/ready' : 'nginx'}
          />
        </Field>
      )}
      <div className="row gap wrap">
        <Field label={t('workflows.interval')} error={errors.intervalSeconds}>
          <input type="number" min={1} max={300} value={node.intervalSeconds ?? 5} onChange={(x) => onChange({ intervalSeconds: Number(x.target.value) })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={!!node.runWithSudo} onChange={(x) => onChange({ runWithSudo: x.target.checked })} /> {t('run.sudo')}
        </label>
      </div>
    </>
  );
}
