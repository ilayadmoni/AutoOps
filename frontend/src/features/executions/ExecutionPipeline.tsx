import type { CSSProperties } from 'react';
import type { MachineRunView } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { useExecutionPaging } from './useExecutionPaging';
import ExecutionPager from './ExecutionPager';
import ExecutionMachineColumn from './ExecutionMachineColumn';

/** The same execution monitor is used by command, chat and workflow entry points. */
export default function ExecutionPipeline({ machines, liveOutput, executionId }: {
  machines: MachineRunView[]; liveOutput: Record<number, string>; executionId: number;
}) {
  const { t } = useI18n();
  const paging = useExecutionPaging(machines);
  return (
    <>
      {paging.pages > 1 && <ExecutionPager paging={paging} count={machines.length} />}
      <div className="executionPipelines" role="region" aria-label={t('nav.executions')} tabIndex={0}
        style={{ '--execution-columns': Math.max(1, paging.visible.length) } as CSSProperties}>
        {paging.visible.map(run => <ExecutionMachineColumn key={run.id} run={run} liveOutput={liveOutput} executionId={executionId} />)}
      </div>
    </>
  );
}
