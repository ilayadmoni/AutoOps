import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshSession, setAccessToken, setSessionExpiredHandler } from '../../lib/apiClient';
import { authService } from '../../services/auth';
import type { Me } from '../../types/api';

export interface AuthContextValue {
  user: Me | null;
  ready: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null, ready: false, isAdmin: false, login: async () => {}, logout: async () => {},
});

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
        if (await refreshSession()) setUser(await authService.me());
      } catch {
        clear();
      } finally {
        setReady(true);
      }
    })();
  }, [clear]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await authService.login(username, password);
    setAccessToken(r.accessToken);
    setUser(await authService.me());
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clear();
    }
  }, [clear]);

  return <AuthContext.Provider value={{ user, ready, isAdmin: user?.role === 'ADMIN', login, logout }}>{children}</AuthContext.Provider>;
}
