import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../services/client';
import type { Command, SearchResult } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { RiskBadge, SearchInput } from '../../components/ui';

const MAX_RESULTS = 8;
const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);

/**
 * Text match over what a command is called, what it says it does and what it actually runs. Every typed word must
 * appear somewhere; hits in the name or the command itself weigh more than the description or category.
 */
function lexicalScore(c: Command, query: string, terms: string[]) {
  const name = c.name.toLowerCase();
  const template = c.commandTemplate.toLowerCase();
  const description = (c.description ?? '').toLowerCase();
  const category = (c.category ?? '').toLowerCase();
  let score = 0;
  for (const term of terms) {
    const hit = (name.includes(term) ? 3 : 0) + (template.includes(term) ? 3 : 0) + (description.includes(term) ? 1.5 : 0) + (category.includes(term) ? 1 : 0);
    if (!hit) return 0;
    score += hit;
  }
  const phrase = query.toLowerCase().trim();
  if (template.startsWith(phrase) || name.startsWith(phrase)) score += 4;
  else if (template.includes(phrase) || name.includes(phrase)) score += 2;
  return score;
}

/**
 * Finds a command without scrolling a list of hundreds: nothing is listed until the user types. Instant text matches
 * come first, and the server's meaning-based search ("stop containers" -> `docker compose down`) joins them a moment
 * later. The chosen command is shown below as a card.
 */
export default function CommandSearch({ commands, value, onChange, error, lowOnly }: {
  commands: Command[];
  value?: number | null;
  onChange: (id: number | null) => void;
  error?: string;
  lowOnly?: boolean;
}) {
  const { t } = useI18n();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(h);
  }, [query]);

  const usable = useMemo(() => commands.filter((c) => c.status !== 'REJECTED' && (!lowOnly || c.riskLevel === 'LOW')), [commands, lowOnly]);
  const smart = useQuery({
    queryKey: ['commands', 'search', debounced, lowOnly],
    queryFn: () => get<SearchResult>(`/commands/search?q=${encodeURIComponent(debounced)}${lowOnly ? '&maxRisk=LOW' : ''}`),
    enabled: debounced.length > 2,
    staleTime: 60_000,
  });

  const results = useMemo(() => {
    const q = query.trim();
    const terms = words(q);
    if (!terms.length) return [];
    const scores = new Map<number, number>();
    for (const c of usable) {
      const s = lexicalScore(c, q, terms);
      if (s) scores.set(c.id, s);
    }
    // Meaning-based matches raise text matches and add the ones that share no words with the query.
    if (debounced === q) {
      (smart.data?.matches ?? []).forEach((m, rank) => {
        if (m.score < 0.3) return;
        scores.set(m.id, (scores.get(m.id) ?? 0) + 6 * m.score + (5 - Math.min(rank, 5)) * 0.2);
      });
    }
    return [...scores.entries()]
      .map(([id, score]) => ({ command: usable.find((c) => c.id === id), score }))
      .filter((r): r is { command: Command; score: number } => !!r.command)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.command);
  }, [usable, query, debounced, smart.data]);

  useEffect(() => setActive(0), [query]);

  const choose = (c: Command) => { onChange(c.id); setQuery(''); };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setQuery(''); }
  };

  const selected = commands.find((c) => c.id === value);
  const typing = query.trim().length > 0;
  return (
    <div className="field commandSearch">
      <span className="fieldLabel">{t('run.command')}</span>
      <SearchInput
        value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
        placeholder={t('commandSearch.placeholder')} aria-label={t('commandSearch.placeholder')}
        role="combobox" aria-expanded={typing} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={typing && results.length ? `${listId}-${active}` : undefined}
      />
      {typing && (
        <div id={listId} role="listbox" className="commandResults" aria-label={t('run.command')}>
          {results.map((c, i) => (
            <div
              key={c.id} id={`${listId}-${i}`} role="option" aria-selected={c.id === value}
              className={'commandResult' + (i === active ? ' active' : '')}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(c)}
            >
              <span className="commandResultHead">
                <strong>{c.name}</strong>
                <RiskBadge risk={c.riskLevel} />
              </span>
              <code dir="ltr">{c.commandTemplate}</code>
              {c.description && <small>{c.description}</small>}
            </div>
          ))}
          {!results.length && (
            <div className="commandResultsEmpty">{smart.isFetching ? t('commandSearch.searching') : t('commandSearch.empty')}</div>
          )}
        </div>
      )}
      {!typing && selected && (
        <div className="commandChosen">
          <span className="commandResultHead"><strong>{selected.name}</strong><RiskBadge risk={selected.riskLevel} /></span>
          <code dir="ltr">{selected.commandTemplate}</code>
        </div>
      )}
      {error && <span className="fieldError">{error}</span>}
    </div>
  );
}
