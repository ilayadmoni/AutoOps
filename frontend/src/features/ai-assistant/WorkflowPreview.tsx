import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight, Workflow as WorkflowIcon, X } from 'lucide-react';
import { get } from '../../shared/api/client';
import type { Command, WorkflowNode } from '../../shared/api/types';
import { Button, IconButton, Tooltip } from '../../shared/ui';
import { FlowCanvas } from '../../shared/ui/flow';
import { useI18n } from '../../i18n/I18nProvider';
import type { CanvasDraft } from './useWorkflowCanvas';

/** Placeholder pipeline while the first draft is being written: three columns of ghost tiles. */
function GhostPipeline() {
  return (
    <div className="ghostPipeline" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="ghostColumn" style={{ '--i': i } as React.CSSProperties}>
          <span className="ghostTile" />
          <span className="ghostLine" />
          <span className="ghostLine short" />
        </div>
      ))}
    </div>
  );
}

/**
 * The split view's canvas pane. It renders the assistant's current workflow proposal as a
 * read-only pipeline, column by column in execution order, and hands it to the builder for
 * editing. Nothing here saves or runs anything; the header says so in the same words the
 * proposal card does.
 */
export default function WorkflowPreview({ draft, building, onOpenBuilder, onClose }: {
  draft: CanvasDraft | null;
  building: boolean;
  onOpenBuilder: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const commands = useQuery({ queryKey: ['commands'], queryFn: () => get<Command[]>('/commands') });
  const errors = Object.fromEntries((draft?.missing ?? []).filter((m) => m.nodeKey).map((m) => [m.nodeKey!, { [m.field]: m.message }]));

  const subtitleFor = useCallback((node: WorkflowNode) => {
    if (node.type === 'COMMAND') return commands.data?.find((c) => c.id === node.commandDefinitionId)?.name;
    if (node.type === 'FILE_TRANSFER') return node.destinationPath ?? undefined;
    if (node.type === 'WAIT_UNTIL') return node.target || (node.checkType ? t('checks.' + node.checkType) : undefined);
    return undefined;
  }, [commands.data, t]);

  const missing = draft?.missing.length ?? 0;
  return (
    <section className={'previewPane' + (building ? ' isBuilding' : '')} aria-label={t('ai.canvasTitle')} aria-busy={building}>
      <header className="previewHead">
        <span className="previewIcon"><WorkflowIcon size={16} /></span>
        <div className="previewTitle">
          <strong>{draft?.name || t('ai.canvasTitle')}</strong>
          <small>{building ? t('ai.canvasBuilding') : t('ai.proposalNote')}</small>
        </div>
        {draft && <span className="badge muted">{t('ai.stepCount', { n: draft.nodes.length })}</span>}
        {missing > 0 && (
          <Tooltip text={t('ai.missing')}>
            <span className="badge warn" tabIndex={0}><AlertTriangle size={12} /> {t('ai.missingCount', { n: missing })}</span>
          </Tooltip>
        )}
        <span className="grow" />
        {draft && (
          <Button small variant="primary" icon={<ArrowUpRight size={15} />} onClick={onOpenBuilder}>
            {t('ai.openInBuilder')}
          </Button>
        )}
        {draft && <IconButton label={t('ai.closeCanvas')} onClick={onClose}><X size={16} /></IconButton>}
      </header>
      <div className="previewBody">
        {draft && draft.nodes.length > 0
          ? <FlowCanvas key={draft.messageIndex} nodes={draft.nodes} errors={errors} readOnly subtitleFor={subtitleFor} />
          : <GhostPipeline />}
        {building && (
          <div className="previewStatus" role="status">
            <span className="thinkingDots" aria-hidden="true"><i /><i /><i /></span>
            {t('ai.canvasBuilding')}
          </div>
        )}
      </div>
      {missing > 0 && !building && (
        <footer className="previewFoot">
          <AlertTriangle size={14} />
          <ul>
            {draft!.missing.map((m, i) => (
              <li key={i}>{m.message}</li>
            ))}
          </ul>
        </footer>
      )}
    </section>
  );
}
