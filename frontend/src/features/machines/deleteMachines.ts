import { del } from '../../services/client';
import { errorMessage } from '../../components/ui';
import type { Machine } from '../../types/api';

/** Reuses per-machine authorization, active-execution protection and audit logging, with bounded concurrency. */
export async function deleteMachines(machines: Machine[]) {
  const deleted: number[] = [];
  const failed: { machine: Machine; message: string }[] = [];
  for (let offset = 0; offset < machines.length; offset += 3) {
    const batch = machines.slice(offset, offset + 3);
    const results = await Promise.allSettled(batch.map(machine => del('/machines/' + machine.id)));
    results.forEach((result, index) => {
      const machine = batch[index];
      if (result.status === 'fulfilled') deleted.push(machine.id);
      else failed.push({ machine, message: errorMessage(result.reason) });
    });
  }
  return { deleted, failed };
}
