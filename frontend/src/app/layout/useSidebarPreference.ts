import { useState } from 'react';
import { useAuth } from '../providers/AuthProvider';

function read(key: string) {
  try { return localStorage.getItem(key) === 'true'; }
  catch { return false; }
}

/** Sidebar density is a device preference, isolated between signed-in accounts. */
export function useSidebarPreference() {
  const { user } = useAuth();
  const key = `autoops.sidebarCollapsed:${user?.id ?? 'guest'}`;
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const collapsed = preferences[key] ?? read(key);
  const toggle = () => {
    const next = !collapsed;
    setPreferences(previous => ({ ...previous, [key]: next }));
    try { localStorage.setItem(key, String(next)); } catch { /* Storage may be disabled. */ }
  };
  return { collapsed, toggle };
}
