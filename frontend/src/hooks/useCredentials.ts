import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { credentialsService } from '../services/credentials';

export const useCredentials = () => useQuery({ queryKey: queryKeys.credentials, queryFn: credentialsService.list });
