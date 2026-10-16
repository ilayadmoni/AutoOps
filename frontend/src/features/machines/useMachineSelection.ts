import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Machine } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { useToast } from '../../components/ui/Toast';
import { deleteMachines } from './deleteMachines';

export function useMachineSelection(machines: Machine[] | undefined) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [ids, setIds] = useState<Set<number>>(() => new Set());
  const [active, setActive] = useState(false);
  const [targets, setTargets] = useState<Machine[] | null>(null);
  const selected = (machines ?? []).filter(machine => ids.has(machine.id));
  const remove = useMutation({
    mutationFn: deleteMachines,
    onSuccess: ({ deleted, failed }) => {
      setIds(new Set(failed.map(item => item.machine.id)));
      setTargets(null);
      if (deleted.length) toast.success(t('machinesBulk.deleted', { n: deleted.length }));
      void qc.invalidateQueries({ queryKey: ['machines'] });
    },
  });
  const toggle = (id: number) => {
    if (!active || remove.isPending) return;
    setIds(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const selectVisible = (visible: Machine[], checked: boolean) => {
    if (!active || remove.isPending) return;
    setIds(current => {
      const next = new Set(current);
      visible.forEach(machine => { if (checked) next.add(machine.id); else next.delete(machine.id); });
      return next;
    });
  };
  return {
    ids, selected, toggle, selectVisible, targets, active, busy: remove.isPending,
    toggleMode: () => {
      if (remove.isPending) return;
      setActive(current => !current); setIds(new Set()); setTargets(null); remove.reset();
    },
    failures: remove.data?.failed ?? [],
    clear: () => { if (!remove.isPending) { setIds(new Set()); remove.reset(); } },
    review: () => { if (selected.length && !remove.isPending) setTargets([...selected]); },
    cancel: () => { if (!remove.isPending) setTargets(null); },
    confirm: () => { if (targets?.length && !remove.isPending) remove.mutate(targets); },
  };
}
