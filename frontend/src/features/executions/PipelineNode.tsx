import { useId, type ReactNode } from 'react';
import { Check, ChevronDown, Circle, LoaderCircle, Pause, X, type LucideIcon } from 'lucide-react';
import { StatusBadge } from '../../components/ui';

/** Shared, keyboard-operable node shell for preflight and recorded execution steps. */
export default function PipelineNode({ status, name, icon: Icon, index, subtitle, open, onToggle, children }: {
  status: string; name: string; icon: LucideIcon; index?: number; subtitle?: ReactNode;
  open: boolean; onToggle: () => void; children?: ReactNode;
}) {
  const bodyId = useId();
  const StateIcon = status === 'SUCCESS' ? Check : status === 'FAILED' ? X
    : status === 'RUNNING' || status === 'PREFLIGHT' ? LoaderCircle
      : status === 'WAITING_APPROVAL' ? Pause : Circle;
  return (
    <li className={'executionNode ' + status.toLowerCase()}>
      <button type="button" className="executionNodeButton" aria-expanded={open}
        aria-controls={bodyId} onClick={onToggle}>
        <span className="executionTile" aria-hidden="true">
          <span className="executionPort input" />
          {index != null && <span className="executionIndex">{String(index).padStart(2, '0')}</span>}
          <Icon className="executionTypeIcon" />
          <span className="executionState"><StateIcon /></span>
          <span className="executionPort output" />
        </span>
        <span className="executionNodeName" dir="auto">{name}</span>
        {subtitle && <span className="executionNodeSubtitle">{subtitle}</span>}
        <span className="executionNodeStatus" role="status" aria-live="polite" aria-atomic="true">
          <StatusBadge status={status} /><ChevronDown size={13} aria-hidden="true" />
        </span>
      </button>
      <div id={bodyId} className="executionNodeDetails" hidden={!open}>{children}</div>
    </li>
  );
}
