import { useMemo, useState } from 'react';
import { SearchInput } from './Input';
import { EmptyState } from './Feedback';

/** Case-insensitive "contains" filter over the text each item exposes. Empty query keeps everything. */
export function useCollectionSearch<T>(items: T[] | undefined, text: (item: T) => Array<string | number | null | undefined>) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (items ?? []).filter((i) => !needle || text(i).filter((x) => x != null && x !== '').join(' ').toLowerCase().includes(needle)),
    // `text` is an inline accessor on every call site; the query and the data are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, needle],
  );
  return { query, setQuery, filtered, searching: !!needle };
}

/** The one search bar every collection page (machines, credentials, workflows, files) shows above its cards. */
export function SearchToolbar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="toolbar">
      <SearchInput className="grow" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function NoMatches({ title, hint }: { title: string; hint: string }) {
  return <EmptyState title={title} hint={hint} />;
}
