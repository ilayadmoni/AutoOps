import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemeChoice } from '../../types/preferences';
import { readStorage, writeStorage } from '../../utils/storage';

const STORAGE_KEY = 'autoops.theme';

export const ThemeContext = createContext<{ theme: ThemeChoice; setTheme: (t: ThemeChoice) => void }>({ theme: 'system', setTheme: () => {} });

function readTheme(): ThemeChoice {
  const v = readStorage(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  useEffect(() => {
    writeStorage(STORAGE_KEY, theme);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
