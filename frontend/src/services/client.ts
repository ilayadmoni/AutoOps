/** Fetch wrapper: bearer access token in memory, single-flight cookie refresh, structured API errors. */
const API = '/api';
const CLIENT_HEADER = { 'X-AutoOps-Client': 'web' };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

/** Exchanges the HttpOnly refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(API + '/auth/refresh', { method: 'POST', credentials: 'include', headers: CLIENT_HEADER })
      .then(async (r) => {
        if (!r.ok) return false;
        const body = (await r.json()) as { accessToken: string };
        accessToken = body.accessToken;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function toError(r: Response): Promise<ApiError> {
  let body: { code?: string; message?: string; fieldErrors?: Record<string, string> } = {};
  try {
    body = await r.json();
  } catch {
    // non-JSON error body
  }
  return new ApiError(r.status, body.code ?? 'HTTP_' + r.status, body.message ?? (r.statusText || 'Request failed'), body.fieldErrors ?? {});
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const isForm = init.body instanceof FormData;
  const headers: Record<string, string> = { ...CLIENT_HEADER, ...((init.headers as Record<string, string>) || {}) };
  if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
  if (!isForm && init.body !== undefined) headers['Content-Type'] = 'application/json';
  let r: Response;
  try {
    r = await fetch(API + path, { ...init, credentials: 'include', headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the AutoOps server');
  }
  if (r.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, init, false);
    accessToken = null;
    onSessionExpired?.();
  }
  if (!r.ok) throw await toError(r);
  if (r.status === 204 || r.status === 202 && r.headers.get('content-length') === '0') return undefined as T;
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = (path: string) => api<void>(path, { method: 'DELETE' });
export const upload = <T,>(path: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api<T>(path, { method: 'POST', body: form });
};

/**
 * Server-sent events over fetch so the Authorization header can be used (EventSource cannot send headers).
 * Returns a function that closes the stream. onClose is called when the stream ends or fails.
 */
export function streamEvents(path: string, onEvent: (type: string, data: unknown) => void, onClose: () => void): () => void {
  const controller = new AbortController();
  (async () => {
    try {
      let r = await fetch(API + path, { headers: { ...CLIENT_HEADER, Authorization: 'Bearer ' + (accessToken ?? '') }, signal: controller.signal });
      if (r.status === 401 && (await refreshSession())) {
        r = await fetch(API + path, { headers: { ...CLIENT_HEADER, Authorization: 'Bearer ' + (accessToken ?? '') }, signal: controller.signal });
      }
      if (!r.ok || !r.body) throw new Error('stream failed');
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let type = 'message';
          const data: string[] = [];
          for (const line of chunk.split('\n')) {
            if (line.startsWith('event:')) type = line.slice(6).trim();
            else if (line.startsWith('data:')) data.push(line.slice(5).trim());
          }
          if (data.length) {
            try {
              onEvent(type, JSON.parse(data.join('\n')));
            } catch {
              onEvent(type, data.join('\n'));
            }
          }
        }
      }
    } catch {
      // aborted or failed; caller falls back to polling / reconnects
    } finally {
      onClose();
    }
  })();
  return () => controller.abort();
}
