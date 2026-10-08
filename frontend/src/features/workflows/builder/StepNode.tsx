import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Clock, FileUp, Lock, ShieldCheck, TerminalSquare } from 'lucide-react';
import type { WorkflowNode } from '../../../types/api';
import { useI18n } from '../../../hooks/useI18n';

export type StepNodeData = {
  node: WorkflowNode;
  index: number;
  errorCount: number;
  subtitle?: string;
};

const ICON = {
  COMMAND: TerminalSquare,
  FILE_TRANSFER: FileUp,
  WAIT_UNTIL: Clock,
} as const;

/**
 * A workflow step on the canvas. Two source handles make the success and failure branches
 * physical things an operator can wire up, which is the whole point of the node view.
 */
function StepNode({ data }: NodeProps) {
  const { t } = useI18n();
  const { node, index, errorCount, subtitle } = data as StepNodeData;
  const Icon = ICON[node.type as keyof typeof ICON] ?? TerminalSquare;
  const classes = [
    'flowNode',
    'type-' + String(node.type).toLowerCase(),
    errorCount > 0 ? 'invalid' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <Handle type="target" position={Position.Left} />
      <div className="flowNodeMain">
        <span className="flowNodeIcon"><Icon size={16} /></span>
        <span className="flowNodeText">
          <strong>{node.name}</strong>
          <small>{subtitle ?? t('steps.' + node.type, undefined, String(node.type))}</small>
        </span>
      </div>
      <div className="flowNodeFoot">
        <span className="flowNodeIndex">{index === 0 ? t('workflows.entry') : '#' + (index + 1)}</span>
        {node.requiresApproval && (
          <span className="branchHint" title={t('workflows.requireApproval')}>
            <ShieldCheck size={11} /> {t('workflows.approval')}
          </span>
        )}
        {errorCount > 0 && <span className="badge bad">{t('workflows.errors', { n: errorCount })}</span>}
        <span className="branchHint ok"><i />{t('workflows.ok')}</span>
        <span className="branchHint bad"><i />{t('workflows.fail')}</span>
      </div>
      <Handle id="success" type="source" position={Position.Right} className="sourceSuccess" style={{ top: '38%' }} />
      <Handle id="failure" type="source" position={Position.Right} className="sourceFailure" style={{ top: '72%' }} />
    </div>
  );
}

export default memo(StepNode);

/** The engine's own preflight gate. Shown as a fixed, unconnectable node so its place is obvious. */
export const PreflightNode = memo(function PreflightNode() {
  const { t } = useI18n();
  return (
    <div className="flowNode locked">
      <div className="flowNodeMain">
        <span className="flowNodeIcon"><Lock size={16} /></span>
        <span className="flowNodeText">
          <strong>{t('workflows.preflight')}</strong>
          <small>{t('workflows.system')}</small>
        </span>
      </div>
      <Handle id="success" type="source" position={Position.Right} className="sourceSuccess" />
    </div>
  );
});
