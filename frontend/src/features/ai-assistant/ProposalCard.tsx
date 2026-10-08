import { Eye, ShieldCheck, Workflow as WorkflowIcon, TerminalSquare } from 'lucide-react';
import { STEP_ICON } from '../../shared/ui/flow/StepNode';
import type { AIOperation, MissingField, WorkflowNode } from '../../shared/api/types';
import { Button, Code, RiskBadge } from '../../shared/ui';
import { useI18n } from '../../i18n/I18nProvider';

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
export default function ProposalCard({ op, onCanvas, onShow, onWorkflow, onRun }: {
  op: AIOperation;
  onCanvas?: boolean;
  onShow?: () => void;
  onWorkflow: () => void;
  onRun: () => void;
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

  return null;
}
