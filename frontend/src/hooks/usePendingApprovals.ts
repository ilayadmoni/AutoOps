import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { approvalsService } from '../services/approvals';

export const usePendingApprovals = (allUsers: boolean, refetchInterval: number) => useQuery({
  queryKey: queryKeys.approvals.pending(allUsers),
  queryFn: () => approvalsService.pending(allUsers),
  refetchInterval,
});
