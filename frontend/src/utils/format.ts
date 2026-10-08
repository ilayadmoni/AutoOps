export function formatDate(iso?: string | null, lang = 'en') {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'medium' });
}

/** Compact date for dense lists: day + month, with the year only when it is not the current one. */
export function shortDate(iso?: string | null, lang = 'en') {
  if (!iso) return '';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' });
}

export function formatBytes(n?: number | null) {
  if (n == null) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

export function duration(start?: string | null, end?: string | null) {
  if (!start) return '';
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  if (ms < 1000) return ms + ' ms';
  const s = Math.round(ms / 1000);
  if (s < 60) return s + 's';
  return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
}

export const TERMINAL = ['SUCCESS', 'FAILED', 'PARTIAL', 'CANCELLED', 'SKIPPED'];
export const isTerminal = (status: string) => TERMINAL.includes(status);
