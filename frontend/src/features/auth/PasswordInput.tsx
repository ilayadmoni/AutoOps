import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { IconButton, TextInput } from '../../shared/ui';

export default function PasswordInput({ value, onChange, showLabel, hideLabel }: {
  value: string;
  onChange: (value: string) => void;
  showLabel: string;
  hideLabel: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="passwordInput">
      <TextInput
        type={shown ? 'text' : 'password'}
        autoComplete="current-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        dir="ltr"
        required
      />
      <IconButton
        label={shown ? hideLabel : showLabel}
        onClick={() => setShown((current) => !current)}
        aria-pressed={shown}
      >
        {shown ? <EyeOff /> : <Eye />}
      </IconButton>
    </div>
  );
}
