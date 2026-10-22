import type { MachineRunView } from '../../types/api';

export const EXECUTION_PAGE_SIZE = 3;

/** Do not leave a batch until all its members finish; skip already-completed batches. */
export function nextExecutionPage(machines: Pick<MachineRunView, 'status'>[], current: number, terminal: (status: string) => boolean) {
  const last = Math.max(0, Math.ceil(machines.length / EXECUTION_PAGE_SIZE) - 1);
  let page = Math.min(Math.max(current, 0), last);
  while (page < last && machines.slice(page * EXECUTION_PAGE_SIZE, (page + 1) * EXECUTION_PAGE_SIZE)
    .every(run => terminal(run.status))) page++;
  return page;
}
