import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from '../../lib/i18n/en';
import { he } from '../../lib/i18n/he';

export type Lang = 'en' | 'he';
const DICTS: Record<Lang, Record<string, string>> = { en, he };
type Vars = Record<string, string | number>;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  dir: 'ltr' | 'rtl';
  t: (key: string, vars?: Vars, fallback?: string) => string;
}

const C = createContext<I18n>({ lang: 'en', setLang: () => {}, dir: 'ltr', t: (k) => k });

function readLang(): Lang {
  try {
    const v = localStorage.getItem('autoops.lang');
    return v === 'he' ? 'he' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('autoops.lang', l);
    } catch {
      // storage unavailable
    }
  }, []);
  const t = useCallback((key: string, vars?: Vars, fallback?: string) => {
    // A `<key>.one` entry, when present, is the singular form used for n === 1.
    const one = vars?.n === 1 ? DICTS[lang][key + '.one'] ?? en[(key + '.one') as keyof typeof en] : undefined;
    let s = one ?? DICTS[lang][key] ?? en[key as keyof typeof en] ?? fallback ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, dir: dir as 'ltr' | 'rtl', t }), [lang, setLang, dir, t]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useI18n = () => useContext(C);
