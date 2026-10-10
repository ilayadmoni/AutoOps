import { Bot } from 'lucide-react';
import { useI18n } from '../../app/providers/I18nProvider';

/** Empty-thread state: identity and scope. The assistant routes free-text requests itself, so there are no presets. */
export default function ChatHero() {
  const { t } = useI18n();
  return (
    <div className="chatHero">
      <div className="orb"><Bot /></div>
      <h2>{t('ai.title')}</h2>
      <p>{t('ai.subtitle')}</p>
    </div>
  );
}
