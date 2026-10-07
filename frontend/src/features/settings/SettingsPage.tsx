import { useI18n, type Lang } from '../../i18n/I18nProvider';
import { useTheme, type ThemeChoice } from './ThemeProvider';
import { useAuth } from '../auth/AuthProvider';
import { Card, PageHeader, Segmented } from '../../shared/ui';

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  return (
    <section>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="cards">
        <Card>
          <h3>{t('settings.theme')}</h3>
          <Segmented
            label={t('settings.theme')} value={theme} onChange={setTheme}
            options={(['system', 'light', 'dark'] as ThemeChoice[]).map((x) => ({ value: x, label: t('settings.theme.' + x) }))}
          />
        </Card>
        <Card>
          <h3>{t('settings.language')}</h3>
          <Segmented
            label={t('settings.language')} value={lang} onChange={setLang}
            options={(['en', 'he'] as Lang[]).map((x) => ({ value: x, label: x === 'en' ? 'English' : 'עברית' }))}
          />
          <p className="muted small">{t('settings.languageHint')}</p>
        </Card>
        <Card>
          <h3>{t('settings.account')}</h3>
          <div className="kv"><span>{t('login.username')}</span><span dir="ltr">{user?.username}</span><span>{t('users.role')}</span><span>{t('role.' + user?.role)}</span></div>
        </Card>
      </div>
    </section>
  );
}
