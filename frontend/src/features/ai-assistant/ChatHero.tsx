import { Bot, Search, Server, TerminalSquare, Workflow } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

/** Empty-thread state: identity, scope, and four concrete starting prompts. */
export default function ChatHero({ onPick }: { onPick: (prompt: string) => void }) {
  const { t } = useI18n();
  const suggestions = [
    { icon: <Search />, label: t('ai.quickFind'), prompt: t('ai.quick.find') },
    { icon: <Workflow />, label: t('ai.quickWorkflow'), prompt: t('ai.quick.workflow') },
    { icon: <TerminalSquare />, label: t('ai.quickExplain'), prompt: t('ai.quick.explain') },
    { icon: <Server />, label: t('ai.quickMachines'), prompt: t('ai.quick.machines') },
  ];
  return (
    <div className="chatHero">
      <div className="orb"><Bot /></div>
      <h2>{t('ai.title')}</h2>
      <p>{t('ai.subtitle')}</p>
      <div className="suggestions">
        {suggestions.map((s) => (
          <button key={s.label} type="button" className="suggestion" onClick={() => onPick(s.prompt)}>
            {s.icon}
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
