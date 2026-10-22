import { useEffect, useState } from 'react';
import type { MachineRunView } from '../../types/api';
import { isTerminal } from '../../utils/format';
import { EXECUTION_PAGE_SIZE, nextExecutionPage } from './executionPaging';

export function useExecutionPaging(machines: MachineRunView[]) {
  const [page, setPage] = useState(0);
  const [following, setFollowing] = useState(() => machines.some(run => !isTerminal(run.status)));
  const pages = Math.max(1, Math.ceil(machines.length / EXECUTION_PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const finished = machines.length > 0 && machines.every(run => isTerminal(run.status));
  useEffect(() => {
    if (following) setPage(current => nextExecutionPage(machines, current, isTerminal));
  }, [machines, following]);
  return {
    page: current, pages, following, finished,
    visible: machines.slice(current * EXECUTION_PAGE_SIZE, (current + 1) * EXECUTION_PAGE_SIZE),
    navigate: (next: number) => { setFollowing(false); setPage(Math.max(0, Math.min(next, pages - 1))); },
    follow: () => setFollowing(true),
  };
}
