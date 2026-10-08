import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, post, refreshSession, setAccessToken, setSessionExpiredHandler } from '../../services/client';
import type { Me } from '../../types/api';

interface Auth {
  user: Me | null;
  ready: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const C = createContext<Auth>({ user: null, ready: false, isAdmin: false, login: async () => {}, logout: async () => {} });

/** On startup: try the refresh cookie, then load /auth/me. Access tokens live in memory only. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setSessionExpiredHandler(clear);
    (async () => {
      try {
        if (await refreshSession()) setUser(await api<Me>('/auth/me'));
      } catch {
        clear();
      } finally {
        setReady(true);
      }
    })();
  }, [clear]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await post<{ accessToken: string }>('/auth/login', { username, password });
    setAccessToken(r.accessToken);
    setUser(await api<Me>('/auth/me'));
  }, []);

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      clear();
    }
  }, [clear]);

  return <C.Provider value={{ user, ready, isAdmin: user?.role === 'ADMIN', login, logout }}>{children}</C.Provider>;
}

export const useAuth = () => useContext(C);
