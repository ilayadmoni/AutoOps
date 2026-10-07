import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, CheckCircle2, Play, Save } from 'lucide-react';
import { ApiError, get, post, put } from '../../shared/api/client';
import type { Command, NodeType, ValidationResult, WorkflowDraft, WorkflowNode, WorkflowView } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, ErrorAlert, Loading, TextInput } from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { cleanParams } from '../commands/ParameterInputs';
import { filesQuery } from '../files/FilesPage';
import RunWorkflowModal from './RunWorkflowModal';
import { setCurrentDraft, takeAiDraft } from './draftStore';
import WorkflowCanvas from './builder/WorkflowCanvas';
import NodePalette from './builder/NodePalette';
import NodeInspector from './builder/NodeInspector';
import { fromFieldErrors, groupErrors, newNode, normalize, type Errors } from './builder/model';

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
  const [selected, setSelected] = useState<string | null>(null);
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
    setCurrentDraft(nodes.length ? draft : null);
  }, [draft, nodes.length]);

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

  const update = useCallback((key: string, patch: Partial<WorkflowNode>) => {
    change((list) => list.map((n) => (n.key === key ? { ...n, ...patch } : n)));
  }, [change]);

  const add = (type: NodeType) => change((list) => {
    const node = newNode(type, list);
    const last = list[list.length - 1];
    const linked = last && !last.successNext ? list.map((n) => (n.key === last.key ? { ...n, successNext: node.key } : n)) : list;
    setSelected(node.key);
    return [...linked, node];
  });

  const remove = (key: string) => {
    if (selected === key) setSelected(null);
    change((list) => list.filter((n) => n.key !== key).map((n) => ({
      ...n,
      successNext: n.successNext === key ? null : n.successNext,
      failureNext: n.failureNext === key ? null : n.failureNext,
    })));
  };

  const connect = useCallback((source: string, branch: 'success' | 'failure', target: string) => {
    update(source, branch === 'success' ? { successNext: target } : { failureNext: target });
  }, [update]);

  const disconnect = useCallback((source: string, branch: 'success' | 'failure') => {
    update(source, branch === 'success' ? { successNext: null } : { failureNext: null });
  }, [update]);

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
  if (workflowId != null && existing.error) return <ErrorAlert error={existing.error} />;
  const stale = save.error instanceof ApiError && save.error.code === 'STALE_VERSION';
  const general = errors._ ?? {};
  const selectedNode = nodes.find((n) => n.key === selected) ?? null;

  return (
    <section className="builderPage">
      <Link to="/workflows" className="back" onClick={(e) => { if (dirty && !window.confirm(t('workflows.discardConfirm'))) e.preventDefault(); }}>
        <ArrowLeft size={14} /> {t('nav.workflows')}
      </Link>
      <div className="pageTitle">
        <div className="grow stack tight">
          <TextInput className="titleInput" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} aria-label={t('common.name')} maxLength={200} />
          {general.name && <span className="fieldError">{general.name}</span>}
          <TextInput className="subtle" aria-label={t('common.description')} placeholder={t('workflows.descriptionPlaceholder')} value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} maxLength={2000} />
        </div>
        <div className="actionsRow">
          {dirty ? <span className="badge warn">{t('workflows.unsaved')}</span> : workflowId != null && <span className="badge ok">{t('workflows.savedBadge')}</span>}
          <Button icon={<CheckCircle2 size={14} />} busy={validate.isPending} disabled={!nodes.length} onClick={() => validate.mutate()}>
            {t('workflows.validate')}
          </Button>
          <Button variant="primary" icon={<Save size={14} />} busy={save.isPending} disabled={!nodes.length} onClick={() => save.mutate()}>
            {t('common.save')}
          </Button>
          <Button icon={<Play size={14} />} disabled={workflowId == null || dirty} title={dirty ? t('workflows.saveBeforeRun') : ''} onClick={() => setRunning(true)}>
            {t('workflows.run')}
          </Button>
        </div>
      </div>

      {fromAi && <div className="alert info"><Bot size={16} /> {t('workflows.aiDraftNote')}</div>}
      {stale ? (
        <div className="alert danger">
          {t('workflows.stale')}
          <Button small onClick={() => { loaded.current = false; setDirty(false); existing.refetch(); }}>{t('workflows.reload')}</Button>
        </div>
      ) : (
        <ErrorAlert error={save.error && !(save.error instanceof ApiError && Object.keys(save.error.fieldErrors).length) ? save.error : null} />
      )}
      {valid === true && !dirty && validate.isSuccess && <div className="alert ok"><CheckCircle2 size={16} /> {t('workflows.valid')}</div>}
      {valid === false && <div className="alert danger">{t('workflows.invalid')}</div>}
      {general.nodes && <div className="alert danger">{general.nodes}</div>}

      <div className="builderShell">
        <NodePalette onAdd={add} />
        <div className="canvasWrap">
          <WorkflowCanvas
            nodes={nodes}
            errors={errors}
            selected={selected}
            workflowId={workflowId}
            onSelect={setSelected}
            onConnect={connect}
            onDisconnect={disconnect}
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
