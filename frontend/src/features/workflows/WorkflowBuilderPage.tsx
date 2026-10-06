import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Clock, FileUp, Lock, Play, Save, ShieldCheck, TerminalSquare, Trash2, Bot } from 'lucide-react';
import { ApiError, get, post, put } from '../../shared/api/client';
import type { Command, NodeType, StoredFile, ValidationError, ValidationResult, WorkflowDraft, WorkflowNode, WorkflowView } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Code, ErrorAlert, Field, Loading, RiskBadge, Spinner, StatusBadge } from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { ParameterInputs, cleanParams } from '../commands/ParameterInputs';
import { filesQuery, useUpload } from '../files/FilesPage';
import RunWorkflowModal from './RunWorkflowModal';
import { setCurrentDraft, takeAiDraft } from './draftStore';

type Errors = Record<string, Record<string, string>>;

function newNode(type: NodeType, existing: WorkflowNode[]): WorkflowNode {
  let i = existing.length + 1;
  while (existing.some((n) => n.key === 's' + i)) i++;
  const base = { key: 's' + i, type, requiresApproval: false, successNext: null, failureNext: null };
  if (type === 'COMMAND') return { ...base, name: 'Run command', commandDefinitionId: null, parameters: {}, runWithSudo: false, timeoutSeconds: 300 };
  if (type === 'FILE_TRANSFER') return { ...base, name: 'Transfer file', storedFileId: null, destinationPath: '/tmp/', overwrite: false, useSudo: false, timeoutSeconds: 300 };
  return { ...base, name: 'Wait until', checkType: 'SERVICE_ACTIVE', target: '', intervalSeconds: 5, timeoutSeconds: 120, parameters: {} };
}

/** Normalizes nodes coming from the API or from an AI proposal into editable state. */
function normalize(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((n) => ({
    ...n,
    type: (n.type as string) === 'FILE' ? 'FILE_TRANSFER' : (n.type as string) === 'WAIT' ? 'WAIT_UNTIL' : n.type,
    parameters: n.parameters ?? {},
    timeoutSeconds: n.timeoutSeconds ?? (n.type === 'WAIT_UNTIL' ? 120 : 300),
    intervalSeconds: n.type === 'WAIT_UNTIL' ? n.intervalSeconds ?? 5 : n.intervalSeconds,
  }));
}

function groupErrors(list: ValidationError[]): Errors {
  const out: Errors = {};
  for (const e of list) {
    const k = e.nodeKey ?? '_';
    out[k] = { ...(out[k] ?? {}), [e.field]: e.message };
  }
  return out;
}

function fromFieldErrors(fe: Record<string, string>): Errors {
  const out: Errors = {};
  for (const [path, msg] of Object.entries(fe)) {
    const m = path.match(/^nodes\.([^.]+)\.(.+)$/);
    const k = m ? m[1] : '_';
    const f = m ? m[2] : path;
    out[k] = { ...(out[k] ?? {}), [f]: msg };
  }
  return out;
}

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
    name, description,
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

  const change = (fn: (n: WorkflowNode[]) => WorkflowNode[]) => { setNodes(fn); setDirty(true); setValid(null); };
  const update = (key: string, patch: Partial<WorkflowNode>) => change((list) => list.map((n) => (n.key === key ? { ...n, ...patch } : n)));
  const add = (type: NodeType) => change((list) => {
    const node = newNode(type, list);
    const last = list[list.length - 1];
    const linked = last && !last.successNext ? list.map((n) => (n.key === last.key ? { ...n, successNext: node.key } : n)) : list;
    setSelected(node.key);
    return [...linked, node];
  });
  const remove = (key: string) => change((list) => list.filter((n) => n.key !== key).map((n) => ({
    ...n, successNext: n.successNext === key ? null : n.successNext, failureNext: n.failureNext === key ? null : n.failureNext,
  })));
  const move = (key: string, dir: -1 | 1) => change((list) => {
    const i = list.findIndex((n) => n.key === key);
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const copy = [...list];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });

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

  return (
    <section>
      <Link to="/workflows" className="back" onClick={(e) => { if (dirty && !window.confirm(t('workflows.discardConfirm'))) e.preventDefault(); }}><ArrowLeft size={14} /> {t('nav.workflows')}</Link>
      <div className="pageTitle">
        <div className="grow stack tight">
          <input className="titleInput" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} aria-label={t('common.name')} maxLength={200} />
          {general.name && <span className="fieldError">{general.name}</span>}
          <input className="subtle" placeholder={t('workflows.descriptionPlaceholder')} value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} maxLength={2000} />
        </div>
        <div className="actionsRow">
          {dirty ? <span className="badge warn">{t('workflows.unsaved')}</span> : workflowId != null && <span className="badge ok">{t('workflows.savedBadge')}</span>}
          <button className="btn" onClick={() => validate.mutate()} disabled={validate.isPending || !nodes.length}>{validate.isPending ? <Spinner /> : <CheckCircle2 size={14} />} {t('workflows.validate')}</button>
          <button className="btn primary" onClick={() => save.mutate()} disabled={save.isPending || !nodes.length}>{save.isPending ? <Spinner /> : <Save size={14} />} {t('common.save')}</button>
          <button className="btn" disabled={workflowId == null || dirty} title={dirty ? t('workflows.saveBeforeRun') : ''} onClick={() => setRunning(true)}><Play size={14} /> {t('workflows.run')}</button>
        </div>
      </div>
      {fromAi && <div className="alert info"><Bot size={16} /> {t('workflows.aiDraftNote')}</div>}
      {stale ? (
        <div className="alert danger">{t('workflows.stale')} <button className="btn small" onClick={() => { loaded.current = false; setDirty(false); existing.refetch(); }}>{t('workflows.reload')}</button></div>
      ) : <ErrorAlert error={save.error && !(save.error instanceof ApiError && Object.keys(save.error.fieldErrors).length) ? save.error : null} />}
      {valid === true && !dirty && validate.isSuccess && <div className="alert ok"><CheckCircle2 size={16} /> {t('workflows.valid')}</div>}
      {valid === false && <div className="alert danger">{t('workflows.invalid')}</div>}
      {general.nodes && <div className="alert danger">{general.nodes}</div>}
      <div className="builder">
        <div className="palette">
          <h3>{t('workflows.addStep')}</h3>
          <button className="btn" onClick={() => add('COMMAND')}><TerminalSquare size={16} /> {t('steps.COMMAND')}</button>
          <button className="btn" onClick={() => add('FILE_TRANSFER')}><FileUp size={16} /> {t('steps.FILE_TRANSFER')}</button>
          <button className="btn" onClick={() => add('WAIT_UNTIL')}><Clock size={16} /> {t('steps.WAIT_UNTIL')}</button>
          <p className="muted small">{t('workflows.paletteHint')}</p>
        </div>
        <div className="flow">
          <div className="flowNode locked"><Lock size={14} /> <small>{t('workflows.system')}</small><b>{t('workflows.preflight')}</b><small className="muted">{t('workflows.preflightHint')}</small></div>
          {nodes.length === 0 && <div className="empty"><strong>{t('workflows.noSteps')}</strong></div>}
          {nodes.map((n, i) => (
            <div key={n.key}>
              <div className="connector">↓</div>
              <NodeCard node={n} index={i} total={nodes.length} nodes={nodes} errors={errors[n.key]} open={selected === n.key}
                onToggle={() => setSelected(selected === n.key ? null : n.key)} onChange={(p) => update(n.key, p)}
                onRemove={() => remove(n.key)} onMove={(d) => move(n.key, d)} commands={commands.data ?? []} files={files.data ?? []} />
            </div>
          ))}
        </div>
      </div>
      {running && workflowId != null && <RunWorkflowModal workflowId={workflowId} name={name} onClose={() => setRunning(false)} />}
    </section>
  );
}

function NodeCard({ node, index, total, nodes, errors, open, onToggle, onChange, onRemove, onMove, commands, files }: {
  node: WorkflowNode; index: number; total: number; nodes: WorkflowNode[]; errors?: Record<string, string>; open: boolean;
  onToggle: () => void; onChange: (p: Partial<WorkflowNode>) => void; onRemove: () => void; onMove: (d: -1 | 1) => void;
  commands: Command[]; files: StoredFile[];
}) {
  const { t } = useI18n();
  const e = errors ?? {};
  const hasErrors = Object.keys(e).length > 0;
  const others = nodes.filter((x) => x.key !== node.key);
  const name = (k?: string | null) => nodes.find((x) => x.key === k)?.name ?? t('workflows.end');
  const paramErrors = Object.fromEntries(Object.entries(e).filter(([k]) => k.startsWith('parameters.')).map(([k, v]) => [k.slice(11), v]));
  return (
    <div className={'flowNode' + (hasErrors ? ' invalid' : '') + (open ? ' open' : '')}>
      <div className="row spread">
        <button className="btn ghost grow start" onClick={onToggle}>
          <small className="badge muted">{index === 0 ? t('workflows.entry') : '#' + (index + 1)}</small>
          <small>{t('steps.' + node.type)}</small> <b>{node.name}</b>
          {node.requiresApproval && <ShieldCheck size={14} />}
          {hasErrors && <span className="badge bad">{t('workflows.errors', { n: Object.keys(e).length })}</span>}
        </button>
        <div className="row">
          <button className="icon" disabled={index === 0} onClick={() => onMove(-1)} aria-label="up"><ArrowUp size={14} /></button>
          <button className="icon" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="down"><ArrowDown size={14} /></button>
          <button className="icon danger" onClick={onRemove} aria-label={t('common.delete')}><Trash2 size={14} /></button>
        </div>
      </div>
      {!open && <small className="muted">✓ → {name(node.successNext)} · ✗ → {node.failureNext ? name(node.failureNext) : t('workflows.stop')}</small>}
      {open && (
        <div className="stack">
          <div className="grid2">
            <Field label={t('common.name')} error={e.name}><input value={node.name} onChange={(x) => onChange({ name: x.target.value })} maxLength={200} /></Field>
            <Field label={t('workflows.key')} error={e.key}><input dir="ltr" value={node.key} disabled /></Field>
          </div>
          {node.type === 'COMMAND' && <CommandConfig node={node} onChange={onChange} commands={commands} errors={e} paramErrors={paramErrors} />}
          {node.type === 'FILE_TRANSFER' && <FileConfig node={node} onChange={onChange} files={files} errors={e} />}
          {node.type === 'WAIT_UNTIL' && <WaitConfig node={node} onChange={onChange} commands={commands} errors={e} paramErrors={paramErrors} />}
          <div className="grid2">
            <Field label={t('workflows.onSuccess')} error={e.successNext}>
              <select value={node.successNext ?? ''} onChange={(x) => onChange({ successNext: x.target.value || null })}>
                <option value="">{t('workflows.end')}</option>
                {others.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.key})</option>)}
              </select>
            </Field>
            <Field label={t('workflows.onFailure')} error={e.failureNext}>
              <select value={node.failureNext ?? ''} onChange={(x) => onChange({ failureNext: x.target.value || null })}>
                <option value="">{t('workflows.stop')}</option>
                {others.map((o) => <option key={o.key} value={o.key}>{o.name} ({o.key})</option>)}
              </select>
            </Field>
          </div>
          {e.edges && <span className="fieldError">{e.edges}</span>}
          <div className="row gap wrap">
            <label className="check"><input type="checkbox" checked={!!node.requiresApproval} onChange={(x) => onChange({ requiresApproval: x.target.checked })} /> {t('workflows.requireApproval')}</label>
            <Field label={t('workflows.timeout')} error={e.timeoutSeconds}><input type="number" min={1} max={3600} value={node.timeoutSeconds ?? ''} onChange={(x) => onChange({ timeoutSeconds: Number(x.target.value) })} /></Field>
          </div>
        </div>
      )}
    </div>
  );
}

function CommandSelect({ value, onChange, commands, lowOnly, error }: { value?: number | null; onChange: (id: number | null) => void; commands: Command[]; lowOnly?: boolean; error?: string }) {
  const { t } = useI18n();
  const usable = commands.filter((c) => c.status !== 'REJECTED' && (!lowOnly || c.riskLevel === 'LOW'));
  const selected = commands.find((c) => c.id === value);
  return (
    <>
      <Field label={t('run.command')} error={error}>
        <select value={value ?? ''} onChange={(x) => onChange(x.target.value ? Number(x.target.value) : null)}>
          <option value="">{t('run.selectCommand')}</option>
          {usable.map((c) => <option key={c.id} value={c.id}>{c.name} [{t('risk.' + c.riskLevel)}]{c.status !== 'APPROVED' ? ' — ' + t('status.' + c.status) : ''}</option>)}
        </select>
      </Field>
      {selected && <div className="row gap wrap"><Code>{selected.commandTemplate}</Code><RiskBadge risk={selected.riskLevel} />{selected.status !== 'APPROVED' && <StatusBadge status={selected.status} />}</div>}
    </>
  );
}

function CommandConfig({ node, onChange, commands, errors, paramErrors }: { node: WorkflowNode; onChange: (p: Partial<WorkflowNode>) => void; commands: Command[]; errors: Record<string, string>; paramErrors: Record<string, string> }) {
  const { t } = useI18n();
  const cmd = commands.find((c) => c.id === node.commandDefinitionId);
  return (
    <>
      <CommandSelect value={node.commandDefinitionId} onChange={(id) => onChange({ commandDefinitionId: id, parameters: {} })} commands={commands} error={errors.commandDefinitionId} />
      {cmd && <ParameterInputs specs={cmd.parameters} values={node.parameters ?? {}} onChange={(p) => onChange({ parameters: p })} errors={paramErrors} />}
      <label className="check"><input type="checkbox" checked={!!node.runWithSudo} onChange={(x) => onChange({ runWithSudo: x.target.checked })} /> {t('run.sudo')}</label>
    </>
  );
}

function FileConfig({ node, onChange, files, errors }: { node: WorkflowNode; onChange: (p: Partial<WorkflowNode>) => void; files: StoredFile[]; errors: Record<string, string> }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const up = useUpload();
  const toast = useToast();
  return (
    <>
      <div className="row gap fileRow">
        <div className="grow">
          <Field label={t('workflows.file')} error={errors.storedFileId}>
            <select value={node.storedFileId ?? ''} onChange={(x) => onChange({ storedFileId: x.target.value ? Number(x.target.value) : null })}>
              <option value="">{t('workflows.selectFile')}</option>
              {files.map((f) => <option key={f.id} value={f.id}>{f.filename} ({f.checksum.slice(0, 8)})</option>)}
            </select>
          </Field>
        </div>
        <input ref={input} type="file" hidden onChange={(x) => {
          const f = x.target.files?.[0];
          x.target.value = '';
          if (f) up.mutate(f, { onSuccess: (s) => { onChange({ storedFileId: s.id }); toast.success(t('files.uploaded', { name: s.filename })); }, onError: (err) => toast.error(err.message) });
        }} />
        <button type="button" className="btn small" disabled={up.isPending} onClick={() => input.current?.click()}>{up.isPending ? <Spinner /> : <FileUp size={14} />} {t('files.upload')}</button>
      </div>
      <Field label={t('workflows.destination')} error={errors.destinationPath} hint={t('workflows.destinationHint')}>
        <input dir="ltr" value={node.destinationPath ?? ''} onChange={(x) => onChange({ destinationPath: x.target.value })} />
      </Field>
      <div className="row gap wrap">
        <label className="check"><input type="checkbox" checked={!!node.overwrite} onChange={(x) => onChange({ overwrite: x.target.checked })} /> {t('workflows.overwrite')}</label>
        <label className="check"><input type="checkbox" checked={!!node.useSudo} onChange={(x) => onChange({ useSudo: x.target.checked })} /> {t('workflows.privileged')}</label>
      </div>
    </>
  );
}

function WaitConfig({ node, onChange, commands, errors, paramErrors }: { node: WorkflowNode; onChange: (p: Partial<WorkflowNode>) => void; commands: Command[]; errors: Record<string, string>; paramErrors: Record<string, string> }) {
  const { t } = useI18n();
  const usesCommand = node.checkType === 'OUTPUT_CONTAINS' || node.checkType === 'EXIT_CODE';
  const cmd = commands.find((c) => c.id === node.commandDefinitionId);
  return (
    <>
      <Field label={t('workflows.checkType')} error={errors.checkType}>
        <select value={node.checkType ?? ''} onChange={(x) => onChange({ checkType: x.target.value as WorkflowNode['checkType'] })}>
          {(['SERVICE_ACTIVE', 'FILE_EXISTS', 'OUTPUT_CONTAINS', 'EXIT_CODE'] as const).map((c) => <option key={c} value={c}>{t('checks.' + c)}</option>)}
        </select>
      </Field>
      {usesCommand ? (
        <>
          <CommandSelect lowOnly value={node.commandDefinitionId} onChange={(id) => onChange({ commandDefinitionId: id, parameters: {} })} commands={commands} error={errors.commandDefinitionId} />
          {cmd && <ParameterInputs specs={cmd.parameters} values={node.parameters ?? {}} onChange={(p) => onChange({ parameters: p })} errors={paramErrors} />}
          {node.checkType === 'OUTPUT_CONTAINS' ? (
            <Field label={t('workflows.expectedOutput')} error={errors.expectedOutput}><input dir="ltr" value={node.expectedOutput ?? ''} onChange={(x) => onChange({ expectedOutput: x.target.value })} /></Field>
          ) : (
            <Field label={t('workflows.expectedExitCode')} error={errors.expectedExitCode}><input type="number" min={0} max={255} value={node.expectedExitCode ?? 0} onChange={(x) => onChange({ expectedExitCode: Number(x.target.value) })} /></Field>
          )}
        </>
      ) : (
        <Field label={node.checkType === 'FILE_EXISTS' ? t('workflows.filePath') : t('workflows.serviceName')} error={errors.target}>
          <input dir="ltr" value={node.target ?? ''} onChange={(x) => onChange({ target: x.target.value })} placeholder={node.checkType === 'FILE_EXISTS' ? '/etc/app/ready' : 'nginx'} />
        </Field>
      )}
      <div className="row gap wrap">
        <Field label={t('workflows.interval')} error={errors.intervalSeconds}><input type="number" min={1} max={300} value={node.intervalSeconds ?? 5} onChange={(x) => onChange({ intervalSeconds: Number(x.target.value) })} /></Field>
        <label className="check"><input type="checkbox" checked={!!node.runWithSudo} onChange={(x) => onChange({ runWithSudo: x.target.checked })} /> {t('run.sudo')}</label>
      </div>
    </>
  );
}
