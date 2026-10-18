import { Bot } from 'lucide-react';
import { useI18n } from '../../app/providers/I18nProvider';
import StarterActions from './StarterActions';
import '../../assets/styles/chat-actions.css';

/** Empty-thread state with immediate guided starts. Free-text input remains available in the composer. */
export default function ChatHero({ onChoose, disabled }: { onChoose: (prompt: string) => void; disabled: boolean }) {
  const { t } = useI18n();
  return (
    <div className="chatHero">
      <div className="orb"><Bot /></div>
      <h1>{t('ai.title')}</h1>
      <p>{t('chatActions.intro')}</p>
      <StarterActions onChoose={onChoose} disabled={disabled} />
    </div>
  );
}
