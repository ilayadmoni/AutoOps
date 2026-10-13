import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Sparkles } from 'lucide-react';
import { get } from '../../services/client';
import type { Command, SearchResult } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import {
  Button, Checkbox, Code, EmptyState, ErrorAlert, Fab, Loading, Modal, PageHeader, RiskBadge, SearchInput, Select, StatusBadge,
} from '../../components/ui';
import RunCommandModal from '../../features/commands/RunCommandModal';
import CreateCommandModal from '../../features/commands/CreateCommandModal';

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
      <PageHeader title={t('commands.title')} subtitle={t('commands.subtitle')} />
      <Fab label={t('commands.create')} onClick={() => setCreating(true)} />
      <div className="toolbar">
        <SearchInput className="grow" aria-label={t('commands.searchPlaceholder')} placeholder={t('commands.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select
          aria-label={t('commands.allCategories')} placeholder={t('commands.allCategories')}
          value={category} onChange={(e) => setCategory(e.target.value)}
          options={categories.map((c) => ({ value: c, label: c }))}
        />
        <Select
          aria-label={t('commands.allRisks')} placeholder={t('commands.allRisks')}
          value={risk} onChange={(e) => setRisk(e.target.value)}
          options={['LOW', 'MEDIUM', 'HIGH'].map((r) => ({ value: r, label: t('risk.' + r) }))}
        />
        <Checkbox
          checked={semantic} onChange={(e) => setSemantic(e.target.checked)}
          label={<><Sparkles size={14} /> {t('commands.semantic')}</>}
        />
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
              <Button small variant="primary" icon={<Play size={14} />} disabled={c.status !== 'APPROVED'} onClick={(e) => { e.stopPropagation(); setRunning(c); }}>{t('commands.run')}</Button>
            </article>
          ))}
        </div>
      )}
      {creating && <CreateCommandModal onClose={() => setCreating(false)} />}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)} footer={
          <Button variant="primary" icon={<Play size={14} />} disabled={detail.status !== 'APPROVED'} onClick={() => { setRunning(detail); setDetail(null); }}>{t('commands.run')}</Button>
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
