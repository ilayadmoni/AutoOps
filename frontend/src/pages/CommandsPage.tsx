import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Plus, Sparkles } from 'lucide-react';
import type { Command } from '../types/api';
import {
  Button, Checkbox, Code, EmptyState, ErrorAlert, Loading, PageHeader, RiskBadge, SearchInput, Select, StatusBadge,
} from '../components';
import CommandDetailModal from '../features/commands/CommandDetailModal';
import CreateCommandModal from '../features/commands/CreateCommandModal';
import RunCommandModal from '../features/commands/RunCommandModal';
import { useCommands } from '../hooks/useCommands';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useI18n } from '../hooks/useI18n';
import { queryKeys } from '../lib/queryKeys';
import { commandsService } from '../services/commands';

export default function CommandsPage() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [risk, setRisk] = useState('');
  const [semantic, setSemantic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Command | null>(null);
  const [running, setRunning] = useState<Command | null>(null);
  const debounced = useDebouncedValue(q.trim(), 250);
  const all = useCommands();
  const search = useQuery({
    queryKey: queryKeys.commands.search(debounced, category, risk),
    queryFn: () => commandsService.search(debounced, category, risk),
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
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>{t('commands.create')}</Button>} />
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
      {detail && <CommandDetailModal command={detail} onClose={() => setDetail(null)} onRun={() => { setRunning(detail); setDetail(null); }} />}
      {running && <RunCommandModal initial={{ commandId: running.id }} onClose={() => setRunning(null)} />}
    </section>
  );
}
