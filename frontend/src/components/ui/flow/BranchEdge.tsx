import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '../../../app/providers/I18nProvider';

export type BranchEdgeData = { onRemove?: () => void };

/**
 * A success or failure connection. Selecting it (click) reveals a remove button at its midpoint,
 * the n8n affordance, so unwiring never depends on discovering a double-click.
 */
function BranchEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected, data }: EdgeProps) {
  const { t } = useI18n();
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  const onRemove = (data as BranchEdgeData | undefined)?.onRemove;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={18} />
      {selected && onRemove && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="flowEdgeRemove nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={onRemove}
            aria-label={t('workflows.removeLink')}
          >
            <Trash2 size={12} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(BranchEdge);
