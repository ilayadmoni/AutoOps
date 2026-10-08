import { get, post } from '../lib/apiClient';
import type { Me } from '../types/api';

export const authService = {
  me: () => get<Me>('/auth/me'),
  login: (username: string, password: string) => post<{ accessToken: string }>('/auth/login', { username, password }),
  logout: () => post<void>('/auth/logout'),
};
