import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '../../../app/providers/I18nProvider';
import { Field, IconButton, TextInput } from '../../../components/ui';
import type { CredentialDraft } from './types';

export default function ImportCredential({ value, onChange }: {
  value: CredentialDraft; onChange: (value: CredentialDraft) => void;
}) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  return <fieldset className="importCredential">
    <legend>{t('machineImport.addCredential')}</legend>
    <Field label={t('machineImport.credentialName')} required>
      <TextInput name="credentialName" required maxLength={150} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} />
    </Field>
    <div className="fieldRow">
      <Field label={t('machineImport.username')} required>
        <TextInput name="sshUsername" dir="ltr" required maxLength={150} autoComplete="off" autoCapitalize="none" spellCheck={false}
          value={value.username} onChange={e => onChange({ ...value, username: e.target.value })} />
      </Field>
      <Field label={t('machineImport.password')} required hint={t('machineImport.credentialHint')}>
        <TextInput name="sshPassword" dir="ltr" type={shown ? 'text' : 'password'} required maxLength={512} autoComplete="new-password"
          value={value.password} onChange={e => onChange({ ...value, password: e.target.value })}
          tail={<IconButton label={t(shown ? 'machineImport.hidePassword' : 'machineImport.showPassword')}
            aria-pressed={shown} onClick={() => setShown(!shown)}>{shown ? <EyeOff size={16} /> : <Eye size={16} />}</IconButton>} />
      </Field>
    </div>
  </fieldset>;
}
