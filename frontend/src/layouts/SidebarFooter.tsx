import { Globe2, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { useTheme } from '../features/settings/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';

export default function SidebarFooter() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { setTheme } = useTheme();
  const langCode = lang === 'en' ? 'EN' : 'HE';
  const nextLanguage = lang === 'en' ? 'עברית' : 'English';
  const isDark = document.documentElement.dataset.theme !== 'light';
  const initial = user?.username?.trim().charAt(0).toUpperCase() || '?';

  function toggleTheme() {
    setTheme(isDark ? 'light' : 'dark');
  }

  return (
    <div className="sidebarFooter">
      <div className="sidebarIdentity">
        <span className="userAvatar" aria-hidden="true">{initial}</span>
        <span className="userDetails">
          <strong dir="ltr">{user?.username}</strong>
          <small>{t('role.' + user?.role)}</small>
        </span>
      </div>
      <div className="sidebarControls">
        <button
          type="button"
          className="sidebarControl languageControl"
          onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
          aria-label={`${t('settings.language')}: ${nextLanguage}`}
        >
          <Globe2 /> <span className="mono">{langCode}</span>
        </button>
        <button type="button" className="sidebarControl iconOnly" onClick={toggleTheme} aria-label={t('settings.theme')}>
          {isDark ? <Moon /> : <Sun />}
        </button>
        <button type="button" className="sidebarLogout" onClick={logout}>
          <LogOut /> <span>{t('nav.logout')}</span>
        </button>
      </div>
    </div>
  );
}
