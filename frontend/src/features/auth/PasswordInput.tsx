import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({ value, onChange, showLabel, hideLabel }: {
  value: string;
  onChange: (value: string) => void;
  showLabel: string;
  hideLabel: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="passwordInput">
      <input
        type={shown ? 'text' : 'password'}
        autoComplete="current-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        dir="ltr"
        required
      />
      <button
        type="button"
        onClick={() => setShown((current) => !current)}
        aria-label={shown ? hideLabel : showLabel}
        aria-pressed={shown}
      >
        {shown ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}
