import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Bot, CheckCircle2, Play, Save } from 'lucide-react';
import { ApiError, get, post, put } from '../../services/client';
import type { Command, ValidationResult, WorkflowDraft, WorkflowNode, WorkflowView } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, ErrorAlert, Loading, PageHeader, TextInput } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { cleanParams } from '../../features/commands/ParameterInputs';
import { filesQuery } from '../files/FilesPage';
import RunWorkflowModal from '../../features/workflows/RunWorkflowModal';
import { takeAiDraft } from '../../features/workflows/draftStore';
import { FlowCanvas } from '../../components/ui/flow';
import NodePalette from '../../features/workflows/builder/NodePalette';
import NodeInspector from '../../features/workflows/builder/NodeInspector';
import { useNodeEditing } from '../../features/workflows/builder/useNodeEditing';
import { fromFieldErrors, groupErrors, INSPECTOR_WIDTH, normalize, type Errors } from '../../features/workflows/builder/model';

export default function WorkflowBuilderPage() {
  const { id } = useParams();
  const workflowId = id ? Number(id) : null;
  const { t } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [version, setVersion] = useState<number | undefined>();
  const [dirty, setDirty] = useState(false);
  const [fromAi, setFromAi] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [valid, setValid] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const loaded = useRef(false);

  const existing = useQuery({ queryKey: ['workflow', workflowId], queryFn: () => get<WorkflowView>('/workflows/' + workflowId), enabled: workflowId != null });
  const commands = useQuery({ queryKey: ['commands'], queryFn: () => get<Command[]>('/commands') });
  const files = useQuery(filesQuery);

  useEffect(() => {
    if (loaded.current) return;
    if (workflowId == null) {
      const ai = takeAiDraft();
      if (ai) {
        setName(ai.name || 'New workflow');
        setDescription(ai.description ?? '');
        setNodes(normalize(ai.nodes ?? []));
        setFromAi(true);
        setDirty(true);
      } else {
        setName(t('workflows.newName'));
      }
      loaded.current = true;
    } else if (existing.data) {
      setName(existing.data.name);
      setDescription(existing.data.description ?? '');
      setNodes(normalize(existing.data.nodes));
      setVersion(existing.data.version);
      loaded.current = true;
    }
  }, [workflowId, existing.data, t]);

  const draft: WorkflowDraft = useMemo(() => ({
    name,
    description,
    nodes: nodes.map((n) => ({ ...n, parameters: n.parameters ? cleanParams(n.parameters) : n.parameters })),
    version,
  }), [name, description, nodes, version]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const change = useCallback((fn: (n: WorkflowNode[]) => WorkflowNode[]) => {
    setNodes(fn);
    setDirty(true);
    setValid(null);
  }, []);

  const { selected, setSelected, update, add, remove, addAfter, connect, disconnect } = useNodeEditing(nodes, change);

  /** Canvas subtitle: the concrete thing a step will do, not just its type. */
  const subtitleFor = useCallback((node: WorkflowNode) => {
    if (node.type === 'COMMAND') return commands.data?.find((c) => c.id === node.commandDefinitionId)?.name;
    if (node.type === 'FILE_TRANSFER') return node.destinationPath ?? undefined;
    if (node.type === 'WAIT_UNTIL') return node.target || (node.checkType ? t('checks.' + node.checkType) : undefined);
    return undefined;
  }, [commands.data, t]);

  const validate = useMutation({
    mutationFn: () => post<ValidationResult>('/workflows/validate', draft),
    onSuccess: (r) => { setErrors(groupErrors(r.errors)); setValid(r.valid); },
  });

  const save = useMutation({
    mutationFn: () => (workflowId == null ? post<WorkflowView>('/workflows', draft) : put<WorkflowView>('/workflows/' + workflowId, draft)),
    onSuccess: (w) => {
      setErrors({});
      setDirty(false);
      setFromAi(false);
      setVersion(w.version);
      setValid(true);
      toast.success(t('workflows.saved'));
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.setQueryData(['workflow', w.id], w);
      if (workflowId == null) nav(`/workflows/${w.id}/edit`, { replace: true });
    },
    onError: (e) => { if (e instanceof ApiError) setErrors(fromFieldErrors(e.fieldErrors)); },
  });

  if (workflowId != null && existing.isLoading) return <Loading />;
  if (workflowId != null && existing.error) return <section><ErrorAlert error={existing.error} /></section>;
  const stale = save.error instanceof ApiError && save.error.code === 'STALE_VERSION';
  const general = errors._ ?? {};
  const selectedNode = nodes.find((n) => n.key === selected) ?? null;

  return (
    <section className="builderPage fillPage">
      <PageHeader
        back={{
          to: '/workflows',
          label: t('nav.workflows'),
          onClick: (e) => { if (dirty && !window.confirm(t('workflows.discardConfirm'))) e.preventDefault(); },
        }}
        title={name || t('workflows.newName')}
        actions={<>
          {dirty ? <span className="badge warn">{t('workflows.unsaved')}</span> : workflowId != null && <span className="badge ok">{t('workflows.savedBadge')}</span>}
          <Button icon={<CheckCircle2 size={15} />} busy={validate.isPending} disabled={!nodes.length} onClick={() => validate.mutate()}>
            {t('workflows.validate')}
          </Button>
          <Button icon={<Play size={15} />} disabled={workflowId == null || dirty} hint={dirty ? t('workflows.saveBeforeRun') : undefined} onClick={() => setRunning(true)}>
            {t('workflows.run')}
          </Button>
          <Button variant="primary" icon={<Save size={15} />} busy={save.isPending} disabled={!nodes.length} onClick={() => save.mutate()}>
            {t('common.save')}
          </Button>
        </>}
      />
      <div className="builderHead">
        <div className="builderTitle">
          <TextInput dir="auto" className="titleInput" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} aria-label={t('common.name')} maxLength={200} />
          {general.name && <span className="fieldError">{general.name}</span>}
          <TextInput dir="auto" className="subtle" aria-label={t('common.description')} placeholder={t('workflows.descriptionPlaceholder')} value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} maxLength={2000} />
        </div>
      </div>

      <div className="builderAlerts">
        {fromAi && <div className="alert info"><Bot size={16} /> {t('workflows.aiDraftNote')}</div>}
        {stale ? (
          <div className="alert danger">
            <span className="grow">{t('workflows.stale')}</span>
            <Button small onClick={() => { loaded.current = false; setDirty(false); existing.refetch(); }}>{t('workflows.reload')}</Button>
          </div>
        ) : (
          <ErrorAlert error={save.error && !(save.error instanceof ApiError && Object.keys(save.error.fieldErrors).length) ? save.error : null} />
        )}
        {valid === true && !dirty && validate.isSuccess && <div className="alert ok"><CheckCircle2 size={16} /> {t('workflows.valid')}</div>}
        {valid === false && <div className="alert danger"><AlertTriangle size={16} /> {t('workflows.invalid')}</div>}
        {general.nodes && <div className="alert danger"><AlertTriangle size={16} /> {general.nodes}</div>}
      </div>

      <div className="builderShell">
        <NodePalette onAdd={add} />
        <div className="canvasWrap">
          <FlowCanvas
            nodes={nodes}
            errors={errors}
            selected={selected}
            storageId={workflowId}
            overlayWidth={selectedNode ? INSPECTOR_WIDTH : 0}
            onSelect={setSelected}
            onConnect={connect}
            onDisconnect={disconnect}
            onAddAfter={addAfter}
            subtitleFor={subtitleFor}
          />
          {/* Overlays the canvas only while a step is selected, so the graph keeps full width. */}
          {selectedNode && (
            <NodeInspector
              node={selectedNode}
              nodes={nodes}
              errors={errors[selectedNode.key] ?? {}}
              commands={commands.data ?? []}
              files={files.data ?? []}
              onChange={(patch) => update(selectedNode.key, patch)}
              onRemove={() => remove(selectedNode.key)}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>

      {running && workflowId != null && <RunWorkflowModal workflowId={workflowId} name={name} onClose={() => setRunning(false)} />}
    </section>
  );
}
