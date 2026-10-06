import type { Lang } from '../../i18n/I18nProvider';

export default function LoginLanguageToggle({ lang, setLang }: {
  lang: Lang;
  setLang: (lang: Lang) => void;
}) {
  return (
    <div className="loginLanguage" role="group" aria-label="Language / שפה" dir="ltr">
      <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
      <button type="button" lang="he" aria-pressed={lang === 'he'} onClick={() => setLang('he')}>עברית</button>
    </div>
  );
}
