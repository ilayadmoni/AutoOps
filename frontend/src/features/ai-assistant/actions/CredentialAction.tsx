import { useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { Button } from '../../../components/ui';
import { useI18n } from '../../../app/providers/I18nProvider';
import CredentialForm from '../../credentials/CredentialForm';

export default function CredentialAction({ payload, disabled }: { payload: Record<string, unknown>; disabled: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const initial = {
    name: typeof payload.name === 'string' ? payload.name : '',
    username: typeof payload.username === 'string' ? payload.username : '',
  };
  return (
    <div className="chatActionFields">
      <p className="muted small">{t('chatActions.credentialsHint')}</p>
      {saved ? <span className="chatActionDone"><Check size={16} />{t('chatActions.credentialSaved')}</span> : (
        <Button small variant="primary" icon={<KeyRound size={14} />} disabled={disabled}
          onClick={() => setOpen(true)}>{t('chatActions.openCredential')}</Button>
      )}
      {open && <CredentialForm credential={null} initial={initial} onClose={() => setOpen(false)} onSaved={() => setSaved(true)} />}
    </div>
  );
}
