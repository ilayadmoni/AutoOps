import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Play } from 'lucide-react';
import { ApiError } from '../../lib/apiClient';
import type { CommandPreview, RunOptions } from '../../types/api';
import { Button, Checkbox, Code, ErrorAlert, Field, Modal, RiskBadge, Select } from '../../components';
import { useApprovedCommands } from '../../hooks/useCommands';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { commandsService } from '../../services/commands';
import { executionsService } from '../../services/executions';
import { cleanParams } from '../../utils/params';
import { defaultRunOptions, toRunRequest } from '../../utils/runOptions';
import RunOptionsForm from '../executions/RunOptionsForm';
import ParameterInputs from './ParameterInputs';

export interface RunCommandInitial {
  commandId?: number;
  machineIds?: number[];
  parameters?: Record<string, string>;
  runWithSudo?: boolean;
}

export default function RunCommandModal({ initial, onClose }: { initial: RunCommandInitial; onClose: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const commands = useApprovedCommands();
  const [commandId, setCommandId] = useState<number | undefined>(initial.commandId);
  const [params, setParams] = useState<Record<string, string>>(initial.parameters ?? {});
  const [sudo, setSudo] = useState(!!initial.runWithSudo);
  const [options, setOptions] = useState<RunOptions>(defaultRunOptions(initial.machineIds ?? []));
  const command = useMemo(() => commands.data?.find((c) => c.id === commandId), [commands.data, commandId]);

  const [preview, setPreview] = useState<CommandPreview | null>(null);
  const [previewError, setPreviewError] = useState<ApiError | null>(null);
  useEffect(() => {
    if (!commandId) return;
    const h = setTimeout(() => {
      commandsService.preview(commandId, cleanParams(params), sudo)
        .then((p) => { setPreview(p); setPreviewError(null); })
        .catch((e) => { setPreview(null); setPreviewError(e instanceof ApiError ? e : null); });
    }, 300);
    return () => clearTimeout(h);
  }, [commandId, params, sudo]);

  const start = useMutation({
    mutationFn: () => executionsService.runCommand({
      ...toRunRequest(options), commandDefinitionId: commandId!, parameters: cleanParams(params), runWithSudo: sudo,
    }),
    onSuccess: (d) => {
      toast.success(t('run.started'));
      onClose();
      nav('/executions/' + d.summary.id);
    },
  });
  const fieldErrors = { ...(previewError?.fieldErrors ?? {}), ...((start.error as ApiError | null)?.fieldErrors ?? {}) };
  const risk = preview?.effectiveRiskLevel ?? command?.riskLevel;

  return (
    <Modal wide title={t('run.commandTitle')} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="primary" icon={<Play size={14} />} busy={start.isPending}
          disabled={!commandId || !options.machineIds.length || !!previewError}
          onClick={() => start.mutate()}
        >
          {t('run.start')}
        </Button>
      </>
    }>
      <div className="stack">
        <ErrorAlert error={start.error} />
        <Field label={t('run.command')}>
          <Select
            block placeholder={t('run.selectCommand')}
            value={commandId ?? ''}
            onChange={(e) => { setCommandId(e.target.value ? Number(e.target.value) : undefined); setParams({}); }}
            options={(commands.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.category})` }))}
          />
        </Field>
        {command && (
          <>
            <div className="row gap wrap"><Code>{command.commandTemplate}</Code><RiskBadge risk={command.riskLevel} /></div>
            {command.description && <p className="muted">{command.description}</p>}
            <ParameterInputs specs={command.parameters} values={params} onChange={setParams} errors={fieldErrors} />
            <Checkbox checked={sudo} onChange={(e) => setSudo(e.target.checked)} label={t('run.sudo')} />
            <div className="previewBox">
              <span className="muted small">{t('run.preview')}</span>
              {preview ? <Code>{preview.resolvedCommand}</Code> : <span className="muted small">{previewError ? previewError.message : '…'}</span>}
              {sudo && preview && <small className="muted">{t('run.sudoNote')}</small>}
            </div>
          </>
        )}
        <RunOptionsForm value={options} onChange={setOptions} errors={fieldErrors} />
        {risk && (
          <div className={'alert ' + (risk === 'HIGH' ? 'danger' : 'info')}>
            {risk === 'HIGH' && <AlertTriangle size={16} />} <RiskBadge risk={risk} />
            <span>{risk === 'HIGH' ? t('run.highRiskNote') : options.mode === 'MANUAL' ? t('run.manualNote') : t('run.automaticNote')}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
