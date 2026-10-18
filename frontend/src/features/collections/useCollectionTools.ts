import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/providers/AuthProvider';
import { del, get, put } from '../../services/client';
import { errorMessage } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useCollectionMessages } from './messages';

export type Collection = 'workflows' | 'commands' | 'credentials' | 'files' | 'machines' | 'machine-folders';
export type Item = { id: number; name?: string; filename?: string; folderName?: string | null };
export const itemName = (item: Item) => item.folderName || item.name || item.filename || String(item.id);

export function useCollectionTools(collection: Collection, data: Item[] | undefined, canDelete: (item: Item) => boolean = () => true) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const text = useCollectionMessages();
  const key = ['favorites', user?.id, collection];
  const favorites = useQuery({ queryKey: key, queryFn: () => get<number[]>(`/favorites/${collection}`), enabled: !!user });
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [targets, setTargets] = useState<Item[] | null>(null);
  const favorite = useMutation({
    mutationFn: ({ id, saved }: { id: number; saved: boolean }) => saved
      ? del(`/favorites/${collection}/${id}`) : put(`/favorites/${collection}/${id}`, {}),
    onMutate: async ({ id, saved }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<number[]>(key);
      qc.setQueryData<number[]>(key, old => saved ? (old ?? []).filter(value => value !== id) : [...(old ?? []), id]);
      return { previous };
    },
    onError: (error, _, context) => { qc.setQueryData(key, context?.previous); toast.error(errorMessage(error)); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: key }); },
  });
  const remove = useMutation({
    mutationFn: async (items: Item[]) => {
      const results: { item: Item; message?: string }[] = [];
      for (const item of items) {
        try { await del(`/${collection}/${item.id}`); results.push({ item }); }
        catch (e) { results.push({ item, message: errorMessage(e) }); }
      }
      return results;
    },
    onSuccess: results => {
      const failed = results.filter(result => result.message);
      setIds(new Set(failed.map(result => result.item.id)));
      setTargets(null);
      if (results.length > failed.length) toast.success(text('deleted', { n: results.length - failed.length }));
      void qc.invalidateQueries({ queryKey: [collection] });
      void qc.invalidateQueries({ queryKey: ['favorites'] });
      if (collection === 'workflows') void qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
  const saved = new Set(favorites.data ?? []);
  const selected = (data ?? []).filter(item => ids.has(item.id) && canDelete(item));
  return {
    active, onlyFavorites, setOnlyFavorites, favorites, favoriteBusy: favorite.isPending, busy: remove.isPending,
    isFavorite: (id: number) => saved.has(id),
    toggleFavorite: (id: number) => { if (!favorite.isPending) favorite.mutate({ id, saved: saved.has(id) }); },
    filter: <T extends Item>(items: T[]) => onlyFavorites ? items.filter(item => saved.has(item.id)) : items,
    ids, selected, targets, failures: remove.data?.filter(result => result.message) ?? [], canDelete,
    toggleMode: () => { if (!remove.isPending) { setActive(!active); setIds(new Set()); remove.reset(); } },
    toggle: (id: number) => {
      if (remove.isPending) return;
      setIds(old => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    },
    selectVisible: (items: Item[]) => { if (!remove.isPending) setIds(old => new Set([...old, ...items.filter(canDelete).map(item => item.id)])); },
    clear: () => { if (!remove.isPending) { setIds(new Set()); remove.reset(); } },
    review: () => { if (selected.length && !remove.isPending) setTargets([...selected]); },
    cancel: () => { if (!remove.isPending) setTargets(null); },
    confirm: () => { if (targets?.length && !remove.isPending) remove.mutate(targets); },
  };
}
export type CollectionTools = ReturnType<typeof useCollectionTools>;
