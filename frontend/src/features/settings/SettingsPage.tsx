import { useI18n, type Lang } from '../../i18n/I18nProvider';
import { useTheme, type ThemeChoice } from './ThemeProvider';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../../shared/ui';

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  return (
    <section>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="cards">
        <article className="card">
          <h3>{t('settings.theme')}</h3>
          <div className="segmented">
            {(['system', 'light', 'dark'] as ThemeChoice[]).map((x) => (
              <button key={x} className={'btn' + (theme === x ? ' primary' : '')} onClick={() => setTheme(x)}>{t('settings.theme.' + x)}</button>
            ))}
          </div>
        </article>
        <article className="card">
          <h3>{t('settings.language')}</h3>
          <div className="segmented">
            {(['en', 'he'] as Lang[]).map((x) => (
              <button key={x} className={'btn' + (lang === x ? ' primary' : '')} onClick={() => setLang(x)}>{x === 'en' ? 'English' : 'עברית'}</button>
            ))}
          </div>
          <p className="muted small">{t('settings.languageHint')}</p>
        </article>
        <article className="card">
          <h3>{t('settings.account')}</h3>
          <div className="kv"><span>{t('login.username')}</span><span dir="ltr">{user?.username}</span><span>{t('users.role')}</span><span>{t('role.' + user?.role)}</span></div>
        </article>
      </div>
    </section>
  );
}
