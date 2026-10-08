import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from '../../lib/i18n/en';
import { he } from '../../lib/i18n/he';
import type { Dir, Lang } from '../../types/preferences';
import { readStorage, writeStorage } from '../../utils/storage';

const STORAGE_KEY = 'autoops.lang';
const DICTS: Record<Lang, Record<string, string>> = { en, he };
type Vars = Record<string, string | number>;

export interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  dir: Dir;
  t: (key: string, vars?: Vars, fallback?: string) => string;
}

export const I18nContext = createContext<I18nContextValue>({ lang: 'en', setLang: () => {}, dir: 'ltr', t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (readStorage(STORAGE_KEY) === 'he' ? 'he' : 'en'));
  const dir: Dir = lang === 'he' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeStorage(STORAGE_KEY, l);
  }, []);
  const t = useCallback((key: string, vars?: Vars, fallback?: string) => {
    let s = DICTS[lang][key] ?? en[key as keyof typeof en] ?? fallback ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, dir, t }), [lang, setLang, dir, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
