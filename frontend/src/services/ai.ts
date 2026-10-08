import { del, get, post } from '../lib/apiClient';
import type { ChatReply, ConversationSummary, ConversationView } from '../types/api';

export const aiService = {
  status: () => get<{ configured: boolean }>('/ai/status'),
  conversations: () => get<ConversationSummary[]>('/ai/conversations'),
  conversation: (id: number) => get<ConversationView>('/ai/conversations/' + id),
  deleteConversation: (id: number) => del('/ai/conversations/' + id),
  chat: (request: { conversationId: number | null; message: string; draftSummary: string | null }) => post<ChatReply>('/ai/chat', request),
};
