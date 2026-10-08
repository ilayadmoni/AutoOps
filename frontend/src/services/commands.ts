import { get, post } from '../lib/apiClient';
import type { Command, CommandPreview, ParameterSpec, SearchResult } from '../types/api';

export interface CommandInput {
  name: string;
  description: string;
  category: string;
  commandTemplate: string;
  parameters: ParameterSpec[];
}

export const commandsService = {
  list: () => get<Command[]>('/commands'),
  listApproved: () => get<Command[]>('/commands?status=APPROVED'),
  search: (q: string, category: string, maxRisk: string) => {
    const params = new URLSearchParams({ q });
    if (category) params.set('category', category);
    if (maxRisk) params.set('maxRisk', maxRisk);
    return get<SearchResult>('/commands/search?' + params);
  },
  create: (input: CommandInput) => post<Command>('/commands', input),
  preview: (id: number, parameters: Record<string, string>, runWithSudo: boolean) =>
    post<CommandPreview>(`/commands/${id}/preview`, { parameters, runWithSudo }),
};
