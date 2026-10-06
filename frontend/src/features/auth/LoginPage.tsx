import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { ErrorAlert } from '../../shared/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="card loginCard" onSubmit={submit}>
        <div className="brand">Auto<span>Ops</span></div>
        <h1>{t('login.title')}</h1>
        <ErrorAlert error={error} />
        <label className="field"><span className="fieldLabel">{t('login.username')}</span>
          <input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" required />
        </label>
        <label className="field"><span className="fieldLabel">{t('login.password')}</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" required />
        </label>
        <button className="btn primary" disabled={busy || !username || !password}>{busy && <Loader2 className="spin" size={14} />} {t('login.submit')}</button>
        <button type="button" className="btn ghost small" onClick={() => setLang(lang === 'en' ? 'he' : 'en')}>{lang === 'en' ? 'עברית' : 'English'}</button>
      </form>
    </div>
  );
}
