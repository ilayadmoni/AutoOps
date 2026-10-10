import { Check, Eye, Plus, Server, ShieldCheck, Workflow as WorkflowIcon, TerminalSquare } from 'lucide-react';
import { STEP_ICON } from '../../components/ui/flow/StepNode';
import type { AIOperation, MissingField, WorkflowNode } from '../../types/api';
import { Button, Code, RiskBadge } from '../../components/ui';
import { useI18n } from '../../app/providers/I18nProvider';

function Missing({ fields }: { fields: MissingField[] }) {
  const { t } = useI18n();
  if (!fields.length) return null;
  return (
    <div className="alert warn small">
      <div>
        <strong>{t('ai.missing')}</strong>
        <ul>
          {fields.map((f, i) => (
            <li key={i}><span>{f.message}</span> <Code>{f.nodeKey ? `${f.nodeKey}.${f.field}` : f.field}</Code></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Renders an AI operation as a reviewable proposal. The header states plainly that nothing has
 * run: the assistant has read, validate and propose tools only, and the UI must not blur that.
 */
export default function ProposalCard({ op, onCanvas, onShow, onWorkflow, onRun, onAddCommand, onAddMachine, added, adding }: {
  op: AIOperation;
  onCanvas?: boolean;
  onShow?: () => void;
  onWorkflow: () => void;
  onRun: () => void;
  onAddCommand: () => void;
  onAddMachine: () => void;
  /** The user already added what this proposal describes. */
  added?: boolean;
  adding?: boolean;
}) {
  const { t } = useI18n();

  if (op.type === 'REPLACE_WORKFLOW_DRAFT') {
    const p = op.payload as { name?: string; nodes?: WorkflowNode[] };
    const nodes = p.nodes ?? [];
    return (
      <div className={'proposal' + (onCanvas ? ' onCanvas' : '')}>
        <div className="proposalHead">
          <ShieldCheck />
          <span>{t('ai.proposalNote')}</span>
          <span className="badge muted">{t('ai.stepCount', { n: nodes.length })}</span>
        </div>
        <div className="proposalBody">
          <strong className="proposalTitle"><WorkflowIcon size={15} /> <span>{p.name}</span></strong>
          <ol className="proposalSteps">
            {nodes.map((n, i) => {
              const Icon = STEP_ICON[n.type as keyof typeof STEP_ICON];
              return (
                <li key={n.key} className={'type-' + String(n.type).toLowerCase()}>
                  <b>{String(i + 1).padStart(2, '0')}</b>
                  {Icon && <Icon size={14} aria-hidden="true" />}
                  <span>{n.name}</span>
                  <small>{t('steps.' + n.type, undefined, n.type)}</small>
                </li>
              );
            })}
          </ol>
          <Missing fields={op.missingFields} />
        </div>
        <div className="proposalFoot">
          <Button variant="primary" small onClick={onWorkflow}>{t('ai.reviewInBuilder')}</Button>
          {onCanvas
            ? <span className="proposalShown"><Eye size={14} /> {t('ai.onCanvas')}</span>
            : onShow && <Button small variant="ghost" icon={<Eye size={14} />} onClick={onShow}>{t('ai.showCanvas')}</Button>}
        </div>
      </div>
    );
  }

  if (op.type === 'PROPOSE_COMMAND_RUN') {
    const p = op.payload as { commandName?: string; preview?: string; riskLevel?: string; machineIds?: number[] };
    return (
      <div className="proposal">
        <div className="proposalHead">
          <ShieldCheck />
          <span>{t('ai.proposalNote')}</span>
          <RiskBadge risk={p.riskLevel} />
        </div>
        <div className="proposalBody">
          <strong className="proposalTitle"><TerminalSquare size={15} /> <span>{t('ai.proposedRun')}: {p.commandName}</span></strong>
          {p.preview && <Code>{p.preview}</Code>}
          <small className="muted">{t('ai.onMachines', { n: p.machineIds?.length ?? 0 })}</small>
          <Missing fields={op.missingFields} />
        </div>
        <div className="proposalFoot">
          <Button variant="primary" small onClick={onRun}>{t('ai.reviewRun')}</Button>
        </div>
      </div>
    );
  }

  if (op.type === 'PROPOSE_NEW_COMMAND') {
    const p = op.payload as { name?: string; description?: string; category?: string; commandTemplate?: string; riskLevel?: string; parameters?: { name: string; type?: string }[] };
    return (
      <div className="proposal">
        <div className="proposalHead">
          <ShieldCheck />
          <span>{t('ai.proposalNote')}</span>
          <RiskBadge risk={p.riskLevel} />
        </div>
        <div className="proposalBody">
          <strong className="proposalTitle"><TerminalSquare size={15} /> <span>{t('ai.newCommand')}: {p.name}</span></strong>
          {p.description && <span className="muted small">{p.description}</span>}
          <Code>{p.commandTemplate}</Code>
          {!!p.parameters?.length && (
            <small className="muted">{t('ai.parameters')}: {p.parameters.map((x) => `${x.name} (${t('paramType.' + (x.type ?? 'STRING'), undefined, x.type ?? 'STRING')})`).join(', ')}</small>
          )}
        </div>
        <div className="proposalFoot">
          {added
            ? <span className="proposalShown"><Check size={14} /> {t('ai.commandAdded')}</span>
            : <Button variant="primary" small icon={<Plus size={14} />} busy={adding} onClick={onAddCommand}>{t('ai.addCommand')}</Button>}
        </div>
      </div>
    );
  }

  if (op.type === 'PROPOSE_MACHINE') {
    const p = op.payload as { name?: string; hostname?: string; sshPort?: number; operatingSystem?: string };
    return (
      <div className="proposal">
        <div className="proposalHead">
          <ShieldCheck />
          <span>{t('ai.proposalNote')}</span>
        </div>
        <div className="proposalBody">
          <strong className="proposalTitle"><Server size={15} /> <span>{t('ai.newMachine')}: {p.name}</span></strong>
          <Code>{`${p.hostname}:${p.sshPort ?? 22}`}</Code>
          {p.operatingSystem && <small className="muted">{p.operatingSystem}</small>}
          <small className="muted">{t('ai.machineNext')}</small>
        </div>
        <div className="proposalFoot">
          {added
            ? <span className="proposalShown"><Check size={14} /> {t('ai.machineAdded')}</span>
            : <Button variant="primary" small icon={<Plus size={14} />} onClick={onAddMachine}>{t('ai.addMachine')}</Button>}
        </div>
      </div>
    );
  }

  return null;
}
