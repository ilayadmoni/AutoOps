import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { filesService } from '../services/files';

export const useFiles = () => useQuery({ queryKey: queryKeys.files, queryFn: filesService.list });

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: filesService.upload,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.files }),
  });
}
