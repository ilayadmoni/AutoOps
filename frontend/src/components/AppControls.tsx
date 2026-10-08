import { Globe2, Moon, Sun } from 'lucide-react';
import { Button, IconButton } from './ui';
import { useTheme } from '../app/providers/ThemeProvider';
import { useI18n } from '../app/providers/I18nProvider';

/**
 * Device preferences, floating in the top corner opposite the navigation: one button switches
 * the language, one switches the theme. Each shows the current state and its tooltip names the
 * state it switches to. The same component sits in the mobile header.
 */
export default function AppControls() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  // Derived from the choice, not from the DOM: the provider applies data-theme in an effect,
  // after this render, so reading the attribute would lag one toggle behind.
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const langCode = lang === 'en' ? 'EN' : 'HE';
  const nextLanguage = lang === 'en' ? 'עברית' : 'English';

  function toggleTheme() {
    setTheme(isDark ? 'light' : 'dark');
  }

  return (
    <div className="appControls">
      <Button
        small
        variant="ghost"
        className="appControl"
        
        onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
        aria-label={`${t('settings.language')}: ${nextLanguage}`}
        hint={nextLanguage}
      >
        <span className="appControlCode">{langCode}</span>
      </Button>
      <span className="appControlsDivider" aria-hidden="true" />
      <IconButton
        className="appControl"
        label={isDark ? t('settings.theme.light') : t('settings.theme.dark')}
        onClick={toggleTheme}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </IconButton>
    </div>
  );
}
