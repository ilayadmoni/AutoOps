import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Plus, Search, Sparkles } from 'lucide-react';
import { ApiError, get, post } from '../../shared/api/client';
import type { Command, ParamType, ParameterSpec, SearchResult } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Code, EmptyState, ErrorAlert, Field, Loading, Modal, PageHeader, RiskBadge, Spinner, StatusBadge } from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import RunCommandModal from './RunCommandModal';

const PARAM_TYPES: ParamType[] = ['STRING', 'INTEGER', 'PATH', 'SERVICE', 'PACKAGE', 'HOSTNAME', 'ENUM'];

export default function CommandsPage() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [risk, setRisk] = useState('');
  const [semantic, setSemantic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Command | null>(null);
  const [running, setRunning] = useState<Command | null>(null);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(h);
  }, [q]);
  const all = useQuery({ queryKey: ['commands'], queryFn: () => get<Command[]>('/commands') });
  const search = useQuery({
    queryKey: ['commands', 'search', debounced, category, risk],
    queryFn: () => get<SearchResult>(`/commands/search?q=${encodeURIComponent(debounced)}${category ? '&category=' + category : ''}${risk ? '&maxRisk=' + risk : ''}`),
    enabled: semantic && debounced.length > 2,
  });
  const categories = useMemo(() => [...new Set((all.data ?? []).map((c) => c.category).filter(Boolean) as string[])].sort(), [all.data]);
  const list = useMemo(() => {
    if (semantic && debounced.length > 2) {
      const ids = (search.data?.matches ?? []).map((m) => m.id);
      return ids.map((id) => all.data?.find((c) => c.id === id)).filter(Boolean) as Command[];
    }
    const needle = debounced.toLowerCase();
    return (all.data ?? []).filter((c) => (!category || c.category === category) && (!risk || c.riskLevel === risk)
      && (!needle || [c.name, c.description, c.commandTemplate, c.category].join(' ').toLowerCase().includes(needle)));
  }, [all.data, search.data, semantic, debounced, category, risk]);

  return (
    <section>
      <PageHeader title={t('commands.title')} subtitle={t('commands.subtitle')}
        actions={<button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} /> {t('commands.create')}</button>} />
      <div className="toolbar">
        <div className="searchBox"><Search size={16} /><input placeholder={t('commands.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('commands.allCategories')}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={risk} onChange={(e) => setRisk(e.target.value)}>
          <option value="">{t('commands.allRisks')}</option>
          {['LOW', 'MEDIUM', 'HIGH'].map((r) => <option key={r} value={r}>{t('risk.' + r)}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={semantic} onChange={(e) => setSemantic(e.target.checked)} /> <Sparkles size={14} /> {t('commands.semantic')}</label>
      </div>
      {semantic && search.data && <p className="muted small">{t('commands.confidence')}: <StatusBadge status={search.data.confidence} /></p>}
      {all.isLoading || search.isFetching ? <Loading /> : all.error ? <ErrorAlert error={all.error} onRetry={() => all.refetch()} /> : !list.length ? (
        <EmptyState title={t('commands.empty')} hint={t('commands.emptyHint')} />
      ) : (
        <div className="list">
          {list.map((c) => (
            <article className="row clickable" key={c.id} onClick={() => setDetail(c)}>
              <div className="grow">
                <b>{c.name}</b>
                <small className="muted">{c.category} · {t('source.' + c.source, undefined, c.source)}</small>
              </div>
              <Code>{c.commandTemplate}</Code>
              <RiskBadge risk={c.riskLevel} />
              <StatusBadge status={c.status} />
              <button className="btn small primary" disabled={c.status !== 'APPROVED'} onClick={(e) => { e.stopPropagation(); setRunning(c); }}><Play size={14} /> {t('commands.run')}</button>
            </article>
          ))}
        </div>
      )}
      {creating && <CreateCommand onClose={() => setCreating(false)} />}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)} footer={
          <button className="btn primary" disabled={detail.status !== 'APPROVED'} onClick={() => { setRunning(detail); setDetail(null); }}><Play size={14} /> {t('commands.run')}</button>
        }>
          <div className="stack">
            <div className="row gap wrap"><RiskBadge risk={detail.riskLevel} /><StatusBadge status={detail.status} /><span className="badge muted">{t('source.' + detail.source, undefined, detail.source)}</span></div>
            {detail.description && <p>{detail.description}</p>}
            <Code>{detail.commandTemplate}</Code>
            {detail.rejectionReason && <div className="alert danger">{t('commands.rejectedBecause')}: {detail.rejectionReason}</div>}
            {detail.status === 'PENDING' && <div className="alert warn">{t('commands.pendingNote')}</div>}
            <h3>{t('commands.parameters')}</h3>
            {detail.parameters.length === 0 ? <p className="muted">{t('params.none')}</p> : (
              <table className="table">
                <thead><tr><th>{t('common.name')}</th><th>{t('params.typeLabel')}</th><th>{t('params.required')}</th><th>{t('common.description')}</th></tr></thead>
                <tbody>{detail.parameters.map((p) => <tr key={p.name}><td><Code>{p.name}</Code></td><td>{t('params.type.' + (p.type ?? 'STRING'))}</td><td>{p.required !== false ? '✓' : ''}</td><td>{p.description}{p.allowedValues?.length ? ' [' + p.allowedValues.join(', ') + ']' : ''}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </Modal>
      )}
      {running && <RunCommandModal initial={{ commandId: running.id }} onClose={() => setRunning(null)} />}
    </section>
  );
}

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]{0,63})\s*}}/g;

function CreateCommand({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '', category: 'SYSTEM', commandTemplate: '' });
  const [params, setParams] = useState<ParameterSpec[]>([]);
  useEffect(() => {
    const names = [...new Set([...form.commandTemplate.matchAll(PLACEHOLDER)].map((m) => m[1]))];
    setParams((old) => names.map((n) => old.find((p) => p.name === n) ?? { name: n, label: n, type: 'STRING', required: true }));
  }, [form.commandTemplate]);
  const save = useMutation({
    mutationFn: () => post<Command>('/commands', { ...form, parameters: params }),
    onSuccess: (c) => {
      toast.success(c.status === 'APPROVED' ? t('commands.createdApproved') : t('commands.createdPending'));
      qc.invalidateQueries({ queryKey: ['commands'] });
      onClose();
    },
  });
  const fe = (save.error as ApiError | null)?.fieldErrors ?? {};
  const setParam = (i: number, patch: Partial<ParameterSpec>) => setParams((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <Modal wide title={t('commands.create')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted small">{t('commands.createHint')}</p>
        <ErrorAlert error={save.error} />
        <div className="grid2">
          <Field label={t('common.name')} error={fe.name}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} /></Field>
          <Field label={t('commands.category')}><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={80} /></Field>
        </div>
        <Field label={t('common.description')}><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} /></Field>
        <Field label={t('commands.template')} error={fe.commandTemplate} hint={t('commands.templateHint')}>
          <input dir="ltr" className="mono" value={form.commandTemplate} onChange={(e) => setForm({ ...form, commandTemplate: e.target.value })} required placeholder="systemctl status {{service}}" />
        </Field>
        {params.length > 0 && (
          <table className="table">
            <thead><tr><th>{t('common.name')}</th><th>{t('params.label')}</th><th>{t('params.typeLabel')}</th><th>{t('params.required')}</th><th>{t('params.allowed')}</th></tr></thead>
            <tbody>
              {params.map((p, i) => (
                <tr key={p.name}>
                  <td><Code>{p.name}</Code></td>
                  <td><input value={p.label ?? ''} onChange={(e) => setParam(i, { label: e.target.value })} /></td>
                  <td><select value={p.type} onChange={(e) => setParam(i, { type: e.target.value as ParamType })}>{PARAM_TYPES.map((x) => <option key={x} value={x}>{t('params.type.' + x)}</option>)}</select></td>
                  <td><input type="checkbox" checked={p.required !== false} onChange={(e) => setParam(i, { required: e.target.checked })} /></td>
                  <td>{p.type === 'ENUM' && <input dir="ltr" placeholder="a,b,c" value={(p.allowedValues ?? []).join(',')} onChange={(e) => setParam(i, { allowedValues: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {fe.parameters && <span className="fieldError">{fe.parameters}</span>}
        <div className="modalFooter inline">
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={save.isPending}>{save.isPending && <Spinner />} {t('commands.submit')}</button>
        </div>
      </form>
    </Modal>
  );
}
