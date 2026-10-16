import { useQuery } from '@tanstack/react-query';
import { get } from '../../services/client';
import type { MachineFolder } from '../../types/api';

export function useMachineFolders() {
  return useQuery({ queryKey: ['machine-folders'], queryFn: () => get<MachineFolder[]>('/machine-folders') });
}
