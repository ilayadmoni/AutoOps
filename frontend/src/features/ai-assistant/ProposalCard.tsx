import { ShieldCheck, Workflow as WorkflowIcon, TerminalSquare } from 'lucide-react';
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
            <li key={i}>{f.nodeKey && <Code>{f.nodeKey}</Code>} <Code>{f.field}</Code>: {f.message}</li>
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
export default function ProposalCard({ op, onWorkflow, onRun }: {
  op: AIOperation;
  onWorkflow: () => void;
  onRun: () => void;
}) {
  const { t } = useI18n();

  if (op.type === 'REPLACE_WORKFLOW_DRAFT') {
    const p = op.payload as { name?: string; nodes?: WorkflowNode[] };
    const nodes = p.nodes ?? [];
    return (
      <div className="proposal">
        <div className="proposalHead">
          <ShieldCheck />
          <span>{t('ai.proposalNote')}</span>
          <span className="badge muted">{t('ai.stepCount', { n: nodes.length })}</span>
        </div>
        <div className="proposalBody">
          <strong><WorkflowIcon size={14} /> {t('ai.proposedWorkflow')}: {p.name}</strong>
          <ol className="proposalSteps">
            {nodes.map((n, i) => (
              <li key={n.key}>
                <b>{String(i + 1).padStart(2, '0')}</b>
                <span>{n.name} <small className="muted">{t('steps.' + n.type, undefined, n.type)}</small></span>
              </li>
            ))}
          </ol>
          <Missing fields={op.missingFields} />
        </div>
        <div className="proposalFoot">
          <Button variant="primary" small onClick={onWorkflow}>{t('ai.reviewInBuilder')}</Button>
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
          <strong><TerminalSquare size={14} /> {t('ai.proposedRun')}: {p.commandName}</strong>
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
