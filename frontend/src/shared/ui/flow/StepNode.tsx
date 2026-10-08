import { memo, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle, Clock, FileUp, Plus, ShieldCheck, TerminalSquare } from 'lucide-react';
import type { NodeType, WorkflowNode } from '../../api/types';
import { useI18n } from '../../../i18n/I18nProvider';
import Menu from '../Menu';
import Tooltip from '../Tooltip';

export type Branch = 'success' | 'failure';

export type StepNodeData = {
  node: WorkflowNode;
  index: number;
  errorCount: number;
  subtitle?: string;
  readOnly?: boolean;
  /** Present in the editor: adds a step wired to this node's given branch. */
  onAddAfter?: (key: string, branch: Branch, type: NodeType) => void;
};

export const STEP_ICON = {
  COMMAND: TerminalSquare,
  FILE_TRANSFER: FileUp,
  WAIT_UNTIL: Clock,
} as const;

export const STEP_TYPES: NodeType[] = ['COMMAND', 'FILE_TRANSFER', 'WAIT_UNTIL'];

/**
 * An unwired output, drawn as n8n draws it: a short stub ending in a "+" that adds the next step
 * already connected to this branch. Sits outside the node box, beside its handle.
 */
function OutputStub({ branch, onAdd, top }: { branch: Branch; onAdd: (type: NodeType) => void; top: string }) {
  const { t } = useI18n();
  return (
    <div className={'flowStub ' + branch} style={{ top }}>
      <span className="flowStubLine" />
      <Menu
        label={t('workflows.addStep')}
        items={STEP_TYPES.map((type) => {
          const Icon = STEP_ICON[type];
          return { key: type, icon: <Icon />, label: t('steps.' + type), hint: t('stepHints.' + type), onSelect: () => onAdd(type) };
        })}
        trigger={
          <button type="button" className="flowStubAdd nodrag nopan" aria-label={t('workflows.addStep')}>
            <Plus size={13} />
          </button>
        }
      />
    </div>
  );
}

function Output({ id, label, top }: { id: Branch; label: ReactNode; top: string }) {
  return (
    <>
      <Handle id={id} type="source" position={Position.Right} className={'flowHandle out ' + id} style={{ top }} />
      <span className={'flowOutLabel ' + id} style={{ top }}>{label}</span>
    </>
  );
}

/**
 * A workflow step on the canvas, in the n8n idiom: a square tile carrying the type icon, the
 * name and detail set beneath it, one input on the leading edge and the success and failure
 * outputs on the trailing edge. The canvas always runs left to right, whatever the UI direction,
 * because it describes execution order rather than reading order.
 */
function StepNode({ data, selected }: NodeProps) {
  const { t } = useI18n();
  const { node, index, errorCount, subtitle, readOnly, onAddAfter } = data as StepNodeData;
  const Icon = STEP_ICON[node.type as keyof typeof STEP_ICON] ?? TerminalSquare;
  const classes = [
    'flowNode',
    'type-' + String(node.type).toLowerCase(),
    errorCount > 0 ? 'invalid' : '',
    selected ? 'isSelected' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={{ '--i': index } as React.CSSProperties}>
      <div className="flowBox">
        <Handle type="target" position={Position.Left} className="flowHandle in" />
        <span className="flowIcon"><Icon /></span>
        <span className="flowIndex">{index + 1}</span>
        {(node.requiresApproval || errorCount > 0) && (
          <span className="flowFlags">
            {node.requiresApproval && (
              <Tooltip text={t('workflows.requireApproval')} describe={false}>
                <span className="flowFlag approval" aria-label={t('workflows.approval')}><ShieldCheck size={12} /></span>
              </Tooltip>
            )}
            {errorCount > 0 && (
              <Tooltip text={t('workflows.errors', { n: errorCount })} describe={false}>
                <span className="flowFlag error" aria-label={t('workflows.errors', { n: errorCount })}><AlertTriangle size={12} /></span>
              </Tooltip>
            )}
          </span>
        )}
        <Output id="success" label={t('workflows.ok')} top="34%" />
        <Output id="failure" label={t('workflows.fail')} top="70%" />
        {!readOnly && onAddAfter && !node.successNext && (
          <OutputStub branch="success" top="34%" onAdd={(type) => onAddAfter(node.key, 'success', type)} />
        )}
      </div>
      <div className="flowLabel">
        <strong dir="auto">{node.name}</strong>
        <small dir="auto">{subtitle ?? t('steps.' + node.type, undefined, String(node.type))}</small>
      </div>
    </div>
  );
}

export default memo(StepNode);

/**
 * The engine's own preflight gate, drawn as n8n draws a trigger: rounded on its leading side,
 * output only. It is fixed and unconnectable so its place at the head of every run is obvious.
 */
export const PreflightNode = memo(function PreflightNode() {
  const { t } = useI18n();
  return (
    <div className="flowNode trigger">
      <div className="flowBox">
        <span className="flowIcon"><ShieldCheck /></span>
        <Handle id="success" type="source" position={Position.Right} className="flowHandle out success" isConnectable={false} />
      </div>
      <div className="flowLabel">
        <strong>{t('workflows.preflight')}</strong>
        <small>{t('workflows.system')}</small>
      </div>
    </div>
  );
});
