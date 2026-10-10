import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, del, get, post, upload } from '../../services/client';
import type { ChatReply, ConversationSummary, ConversationView, StoredFile } from '../../types/api';
import { errorMessage } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import type { Msg } from './ChatMessage';
import { referencesOf, serialize, textDoc, MAX_LENGTH, isEmpty, type Doc, type Tag } from './editor/mentionDoc';

/** Everything one chat request needs, so a failed request can be sent again exactly as it was. */
export type ChatRequest = {
  conversationId: number | null;
  message: string;
  fileIds: number[];
  machineIds: number[];
  draftSummary: string | null;
  /** Which conversation view sent it; a reply for a view the user has left must not touch the current one. */
  view: number;
  /** The workspace revision the draft was read at. */
  revision: number;
  servers: Tag[];
  files: Tag[];
  retry?: boolean;
};

type Hooks = {
  /** Reads the workspace as the user sees it right now, for the request about to be sent. */
  prepare: (text: string, refs: { servers: Tag[]; files: Tag[] }) => { draftSummary: string | null; revision: number };
  onReply: (reply: ChatReply, request: ChatRequest, current: boolean) => void;
  onFail: (error: unknown, request: ChatRequest, current: boolean) => void;
};

export function useChatSession(hooks: Hooks) {
  const qc = useQueryClient();
  const toast = useToast();
  const status = useQuery({ queryKey: ['ai', 'status'], queryFn: () => get<{ configured: boolean }>('/ai/status') });
  const conversations = useQuery({ queryKey: ['ai', 'conversations'], queryFn: () => get<ConversationSummary[]>('/ai/conversations') });
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [doc, setDoc] = useState<Doc>([]);
  const view = useRef(0);
  const last = useRef<ChatRequest | null>(null);
  const hook = useRef(hooks);
  hook.current = hooks;

  const send = useMutation({
    mutationFn: (r: ChatRequest) => post<ChatReply>('/ai/chat', {
      conversationId: r.conversationId, message: r.message, draftSummary: r.draftSummary, fileIds: r.fileIds, machineIds: r.machineIds,
    }),
    onMutate: (r) => {
      if (!r.retry) setMessages((items) => [...items, { role: 'user', content: r.message }]);
    },
    onSuccess: (reply, r) => {
      const current = r.view === view.current;
      if (current) {
        setConversationId(reply.conversationId);
        setMessages((items) => [...items, { role: 'assistant', content: reply.message, operations: reply.operations }]);
      }
      hook.current.onReply(reply, r, current);
      qc.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    },
    onError: (error, r) => hook.current.onFail(error, r, r.view === view.current),
  });
  const attach = useMutation({
    mutationFn: (file: File) => upload<StoredFile>('/files', file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const clearComposer = () => setDoc([]);
  const reset = () => {
    view.current++; last.current = null;
    setConversationId(null); setMessages([]); clearComposer(); send.reset();
  };
  const open = async (id: number) => {
    const conversation = await get<ConversationView>('/ai/conversations/' + id);
    view.current++; last.current = null;
    setConversationId(id); clearComposer(); send.reset();
    const next: Msg[] = conversation.messages.map((m) => ({ role: m.role, content: m.content, operations: m.operations }));
    setMessages(next);
    return next;
  };
  const remove = useMutation({
    mutationFn: (id: number) => del('/ai/conversations/' + id),
    onSuccess: (_, id) => {
      if (id === conversationId) reset();
      qc.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    },
  });

  const submit = (value: Doc | string = doc) => {
    const input = typeof value === 'string' ? textDoc(value) : value;
    const message = serialize(input);
    if (isEmpty(input) || message.length > MAX_LENGTH || send.isPending || attach.isPending || !status.data?.configured) return;
    const { servers, files } = referencesOf(input);
    const { draftSummary, revision } = hook.current.prepare(message, { servers, files });
    const request: ChatRequest = {
      conversationId, message, draftSummary, revision, view: view.current, servers, files,
      fileIds: files.map((f) => f.id), machineIds: servers.map((s) => s.id),
    };
    last.current = request;
    clearComposer();
    send.mutate(request);
  };
  /** Sends the failed request again with the context it was first sent with. */
  const retry = () => {
    if (last.current && !send.isPending) send.mutate({ ...last.current, retry: true });
  };
  return { status, conversations, conversationId, messages, doc, setDoc, send, attach, reset, open, remove, submit, retry,
    failed: send.isError && last.current !== null && last.current.view === view.current,
    error: send.error instanceof ApiError || send.error instanceof Error ? send.error : null };
}
