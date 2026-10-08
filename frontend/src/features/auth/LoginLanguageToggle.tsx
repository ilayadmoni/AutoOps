import type { Lang } from '../../types/preferences';
import { Segmented } from '../../components';

export default function LoginLanguageToggle({ lang, setLang }: {
  lang: Lang;
  setLang: (lang: Lang) => void;
}) {
  return (
    <div className="loginLanguage" dir="ltr">
      <Segmented
        value={lang}
        label="Language / שפה"
        onChange={setLang}
        options={[
          { value: 'en', label: 'English' },
          { value: 'he', label: 'עברית' },
        ]}
      />
    </div>
  );
}
