import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { executionsService } from '../../services/executions';
import { isTerminal } from '../../utils/format';

/** Keeps the last ~20k characters of live output per step. */
const LIVE_OUTPUT_LIMIT = 20000;

/**
 * An execution kept current while it runs: server-sent events for live output and change
 * notifications, with polling as the fallback (fast while the stream is down, a slow safety net
 * while it is up, off once the execution has finished).
 */
export function useLiveExecution(executionId: number) {
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const [liveOutput, setLiveOutput] = useState<Record<number, string>>({});
  const refreshTimer = useRef<number | null>(null);

  const query = useQuery({
    queryKey: queryKeys.executions.detail(executionId),
    queryFn: () => executionsService.get(executionId),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (d && isTerminal(d.summary.status)) return false;
      return live ? 10000 : 2000;
    },
  });
  const loaded = !!query.data;
  const terminal = query.data ? isTerminal(query.data.summary.status) : false;

  useEffect(() => {
    if (!loaded || terminal) return;
    let closed = false;
    let stop: (() => void) | null = null;
    let retry: number | undefined;
    const connect = () => {
      stop = executionsService.stream(executionId, (type, data) => {
        setLive(true);
        if (type === 'STEP_OUTPUT') {
          const d = data as { stepRunId: number; chunk: string };
          setLiveOutput((o) => ({ ...o, [d.stepRunId]: ((o[d.stepRunId] ?? '') + d.chunk).slice(-LIVE_OUTPUT_LIMIT) }));
          return;
        }
        // Any other event means the execution changed: refetch, coalescing bursts.
        if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(() => qc.invalidateQueries({ queryKey: queryKeys.executions.detail(executionId) }), 150);
      }, () => {
        setLive(false);
        if (!closed) retry = window.setTimeout(connect, 3000);
      });
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(retry);
      stop?.();
    };
  }, [executionId, loaded, terminal, qc]);

  return { query, terminal, live, liveOutput };
}
