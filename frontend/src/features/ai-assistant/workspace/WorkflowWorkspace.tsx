import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { get } from '../../../services/client';
import type { Command, NodeType, StoredFile, WorkflowNode } from '../../../types/api';
import { Button } from '../../../components/ui';
import { FlowCanvas, STEP_ICON, STEP_TYPES } from '../../../components/ui/flow';
import { useI18n } from '../../../app/providers/I18nProvider';
import { INSPECTOR_WIDTH, type Errors } from '../../workflows/builder/model';
import NodeInspector from '../../workflows/builder/NodeInspector';
import { useNodeEditing } from '../../workflows/builder/useNodeEditing';
import RunWorkflowModal from '../../workflows/RunWorkflowModal';
import { setAiDraft } from '../../workflows/draftStore';
import type { Action, WorkspaceState } from './model';
import { useWorkspaceActions } from './useWorkspaceActions';
import WorkspaceHead from './WorkspaceHead';
import WorkspaceNotices from './WorkspaceNotices';
import WorkspaceRecovery from './WorkspaceRecovery';

/** Errors shown on the canvas: what the assistant says is missing, overlaid by the latest validation. */
function nodeErrors(state: WorkspaceState): Errors {
  const out: Errors = {};
  for (const m of state.missing) if (m.nodeKey) out[m.nodeKey] = { ...out[m.nodeKey], [m.field]: m.message };
  for (const [key, fields] of Object.entries(state.errors)) out[key] = { ...out[key], ...fields };
  return out;
}

/**
 * The editable workflow beside the chat. The assistant proposes into it and the user edits it directly with the same
 * canvas, inspector and step helpers as the builder; saving and executing are explicit buttons here and nowhere else.
 */
export default function WorkflowWorkspace({ state, dispatch, change, building, canRetry, onRetry, onClose }: {
  state: WorkspaceState;
  dispatch: (action: Action) => void;
  change: (update: (nodes: WorkflowNode[]) => WorkflowNode[]) => void;
  /** The assistant is writing a reply right now. */
  building: boolean;
  canRetry: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const nav = useNavigate();
  const edit = useNodeEditing(state.nodes, change);
  const actions = useWorkspaceActions(state, dispatch);
  const commands = useQuery({ queryKey: ['commands'], queryFn: () => get<Command[]>('/commands') });
  const files = useQuery({ queryKey: ['files'], queryFn: () => get<StoredFile[]>('/files') });
  const errors = useMemo(() => nodeErrors(state), [state]);
  const selectedNode = state.nodes.find((n) => n.key === edit.selected) ?? null;

  const subtitleFor = useCallback((node: WorkflowNode) => {
    if (node.type === 'COMMAND') return commands.data?.find((c) => c.id === node.commandDefinitionId)?.name;
    if (node.type === 'FILE_TRANSFER') return node.destinationPath ?? undefined;
    if (node.type === 'WAIT_UNTIL') return node.target || (node.checkType ? t('checks.' + node.checkType) : undefined);
    return undefined;
  }, [commands.data, t]);

  const openBuilder = () => {
    if (state.workflowId != null && state.savedRevision === state.revision) return nav(`/workflows/${state.workflowId}/edit`);
    setAiDraft({ name: state.name || 'AI draft', description: state.description, nodes: state.nodes });
    nav('/workflows/new');
  };

  return (
    <section className={'previewPane workspace' + (building ? ' isBuilding' : '')} aria-label={t('ai.canvasTitle')} aria-busy={building}>
      <WorkspaceHead
        state={state} building={building} saving={actions.save.isPending}
        onName={(name) => dispatch({ type: 'meta', name })} onSave={() => actions.save.mutate()}
        onExecute={() => actions.setRunning(true)} onOpenBuilder={openBuilder} onClose={onClose}
      />
      <div className="workspaceTools" role="toolbar" aria-label={t('workflows.addStep')}>
        {STEP_TYPES.map((type: NodeType) => {
          const Icon = STEP_ICON[type];
          return <Button key={type} small variant="ghost" icon={<Plus size={14} />} onClick={() => edit.add(type)}><Icon size={14} aria-hidden="true" /> {t('steps.' + type)}</Button>;
        })}
      </div>
      <div className="previewBody">
        {state.nodes.length > 0 ? (
          <FlowCanvas
            nodes={state.nodes} errors={errors} selected={edit.selected} overlayWidth={selectedNode ? INSPECTOR_WIDTH : 0}
            onSelect={edit.setSelected} onConnect={edit.connect} onDisconnect={edit.disconnect} onAddAfter={edit.addAfter}
            subtitleFor={subtitleFor}
          />
        ) : <WorkspaceRecovery failure={state.failure} canRetry={canRetry} retrying={building} onRetry={onRetry} />}
        {building && (
          <div className="previewStatus" role="status">
            <span className="thinkingDots" aria-hidden="true"><i /><i /><i /></span>
            {t('ai.canvasBuilding')}
          </div>
        )}
        {selectedNode && (
          <NodeInspector
            node={selectedNode} nodes={state.nodes} errors={errors[selectedNode.key] ?? {}}
            commands={commands.data ?? []} files={files.data ?? []}
            onChange={(patch) => edit.update(selectedNode.key, patch)} onRemove={() => edit.remove(selectedNode.key)}
            onClose={() => edit.setSelected(null)}
          />
        )}
      </div>
      {state.failure && state.nodes.length > 0 && (
        <div className="alert danger workspaceFail" role="alert">
          <span className="grow">{state.failure.message} {t('ai.draftKept')}</span>
          {canRetry && <Button small onClick={onRetry}>{t('ai.retry')}</Button>}
        </div>
      )}
      <WorkspaceNotices
        state={state} stale={actions.stale} saveError={actions.saveError} reloading={actions.reload.isPending}
        onReload={() => actions.reload.mutate()}
        onApplyPending={() => state.pending && dispatch({ type: 'apply', proposal: state.pending })}
        onDismissPending={() => dispatch({ type: 'pending', proposal: null })}
      />
      {actions.running && state.workflowId != null && (
        <RunWorkflowModal
          workflowId={state.workflowId} name={state.name} initialMachineIds={state.servers.map((s) => s.id)}
          onClose={() => actions.setRunning(false)}
        />
      )}
    </section>
  );
}
