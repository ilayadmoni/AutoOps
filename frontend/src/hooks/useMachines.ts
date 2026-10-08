import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { machinesService } from '../services/machines';

export const useMachines = () => useQuery({ queryKey: queryKeys.machines, queryFn: machinesService.list });
