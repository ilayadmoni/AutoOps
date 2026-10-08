import { Globe2, LogOut, Moon, Sun } from 'lucide-react';
import { Button, IconButton } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { useTheme } from '../../hooks/useTheme';

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
        <Button
          className="sidebarControl languageControl"
          onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
          aria-label={`${t('settings.language')}: ${nextLanguage}`}
        >
          <Globe2 /> <span className="mono">{langCode}</span>
        </Button>
        <IconButton label={t('settings.theme')} className="sidebarControl iconOnly" onClick={toggleTheme}>
          {isDark ? <Moon /> : <Sun />}
        </IconButton>
        <Button className="sidebarLogout" onClick={logout}>
          <LogOut /> <span>{t('nav.logout')}</span>
        </Button>
      </div>
    </div>
  );
}
