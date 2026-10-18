import { matchingCredentials, useImportCredentials } from './useImportCredentials';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, upload } from '../../../services/client';
import { useI18n } from '../../../app/providers/I18nProvider';
import type { CredentialDraft, ImportResult, ImportRow } from './types';

/** Password drafts stay in this dialog only, never in local storage or the mutation cache. */
export function useMachineImport() {
  const qc = useQueryClient();
  const credentials = useImportCredentials();
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, CredentialDraft>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    credentials.reset();
    setFile(null); setRows([]); setSelected(new Set()); setDrafts({}); setResult(null); setError(null);
  }

  async function pick(next?: File) {
    if (!next) return;
    reset();
    if (!next.name.toLowerCase().endsWith('.mxtsessions') || next.size === 0 || next.size > 2 * 1024 * 1024) {
      setError(new Error(t('machineImport.fileHint'))); return;
    }
    setBusy(true);
    try {
      const preview = await upload<{ rows: ImportRow[] }>('/machines/import/preview', next);
      setFile(next); setRows(preview.rows);
      setSelected(new Set(preview.rows.filter(row => !row.skipReason).map(row => row.index)));
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }

  function toggle(index: number) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
    // Deselecting also discards any password draft for that machine.
    if (selected.has(index)) credential(index);
  }

  function credential(index: number, value?: CredentialDraft) {
    credentials.choose(index);
    setDrafts(current => {
      const next = { ...current };
      if (value) next[index] = value; else delete next[index];
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    selectGroup(rows.map(row => row.index), checked);
  }

  function selectGroup(indices: number[], checked: boolean) {
    const requested = new Set(indices);
    const eligible = rows.filter(row => !row.skipReason && requested.has(row.index)).map(row => row.index);
    setSelected(current => {
      const next = new Set(current);
      for (const index of eligible) { if (checked) next.add(index); else next.delete(index); }
      return next;
    });
    if (!checked) setDrafts(current => {
      const next = { ...current };
      for (const index of eligible) delete next[index];
      return next;
    });
  }

  async function submit() {
    if (!file || !selected.size) { setError(new Error(t('machineImport.noSelection'))); return; }
    setBusy(true); setError(null);
    try {
      if (!credentials.query.data || credentials.query.isError) throw new Error(t('machineImport.credentialsUnavailable'));
      for (const index of selected) {
        const row = rows.find(row => row.index === index)!;
        const matches = matchingCredentials(row, credentials.query.data);
        if (!drafts[index] && matches.length > 1 && !matches.some(match => match.id === credentials.ids[index])) {
          throw new Error(t('machineImport.ambiguousSession', { name: row.name }));
        }
      }
      const body = new FormData();
      body.append('file', file);
      body.append('selection', new Blob([JSON.stringify({ selections: [...selected].map(index => ({
        index, credential: drafts[index] ?? null,
        existingCredentialId: drafts[index] ? null : credentials.ids[index]
          ?? matchingCredentials(rows.find(row => row.index === index)!, credentials.query.data ?? []).at(0)?.id ?? null,
      })) })], { type: 'application/json' }));
      const response = await api<ImportResult>('/machines/import', { method: 'POST', body });
      setResult(response); setDrafts({}); setSelected(new Set());
      await Promise.all(['machines', 'machine-folders', 'credentials'].map(key => qc.invalidateQueries({ queryKey: [key] })));
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }

  return { credentials, file, rows, selected, drafts, busy, error, result, reset, pick, toggle, toggleAll, selectGroup, credential, submit };
}
