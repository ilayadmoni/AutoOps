import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, ErrorAlert, TextInput } from '../../shared/ui';
import LoginLanguageToggle from './LoginLanguageToggle';
import LoginVisual from './LoginVisual';
import PasswordInput from './PasswordInput';
import { loginCopy } from './loginCopy';

export default function LoginPage() {
  const { login } = useAuth();
  const { lang, setLang, dir } = useI18n();
  const copy = loginCopy[lang];
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
    <div className="loginShell" dir={dir}>
      <LoginVisual copy={copy} />
      <section className="loginPanel">
        <LoginLanguageToggle lang={lang} setLang={setLang} />
        <div className="loginFormWrap">
          <form className="loginForm" onSubmit={submit}>
            <div className="loginHeading"><h1>{copy.title}</h1><p>{copy.welcome}</p></div>
            <ErrorAlert error={error} />
            <label className="field"><span className="fieldLabel">{copy.username}</span>
              <TextInput autoFocus autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} dir="ltr" required />
            </label>
            <label className="field"><span className="fieldLabel">{copy.password}</span>
              <PasswordInput value={password} onChange={setPassword} showLabel={copy.showPassword} hideLabel={copy.hidePassword} />
            </label>
            <Button
              type="submit" variant="primary" className="loginSubmit"
              busy={busy} disabled={!username || !password}
            >
              {busy ? copy.busy : copy.submit}
            </Button>
            <div className="loginSecurity"><ShieldCheck /> <span>{copy.session}</span></div>
          </form>
        </div>
      </section>
    </div>
  );
}
