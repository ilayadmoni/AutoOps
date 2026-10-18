import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../../services/client';
import type { Credential } from '../../../types/api';
import type { ImportRow } from './types';

export function matchingCredentials(row: ImportRow, credentials: Credential[]) {
  return row.username ? credentials.filter(credential => credential.username === row.username) : [];
}

export function useImportCredentials() {
  const query = useQuery({ queryKey: ['credentials'], queryFn: () => get<Credential[]>('/credentials') });
  const [ids, setIds] = useState<Record<number, number>>({});
  const [defaultId, setDefaultId] = useState<number | null>(null);
  const choose = (index: number, id?: number) => setIds(current => {
    const next = { ...current }; if (id == null) delete next[index]; else next[index] = id; return next;
  });
  return { query, ids, defaultId, setDefaultId, choose, reset: () => { setIds({}); setDefaultId(null); } };
}
export type ImportCredentials = ReturnType<typeof useImportCredentials>;
