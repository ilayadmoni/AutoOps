import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { commandsService } from '../services/commands';

export const useCommands = () => useQuery({ queryKey: queryKeys.commands.all, queryFn: commandsService.list });

export const useApprovedCommands = () => useQuery({ queryKey: queryKeys.commands.approved, queryFn: commandsService.listApproved });
