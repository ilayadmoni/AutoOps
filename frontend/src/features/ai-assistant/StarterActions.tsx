import { ArrowRight, KeyRound, Play, Server, TerminalSquare, Workflow } from 'lucide-react';
import { useI18n } from '../../app/providers/I18nProvider';

const STARTERS = [
  { id: 'run', Icon: Play }, { id: 'server', Icon: Server }, { id: 'workflow', Icon: Workflow },
  { id: 'command', Icon: TerminalSquare }, { id: 'credential', Icon: KeyRound },
] as const;

/** Sends the localized request through the normal chat API; the reply comes from the configured model. */
export default function StarterActions({ onChoose, disabled }: { onChoose: (prompt: string) => void; disabled: boolean }) {
  const { t } = useI18n();
  return (
    <div className="suggestions chatStarters">
      {STARTERS.map(({ id, Icon }) => (
        <button key={id} type="button" className={`tile starterAction${id === 'run' ? ' starterActionPrimary' : ''}`}
          disabled={disabled} onClick={() => onChoose(t(`chatActions.${id}.prompt`))}>
          <span className="tileIcon"><Icon aria-hidden="true" /></span>
          <span className="tileText">
            <strong>{t(`chatActions.${id}.title`)}</strong>
            <small>{t(`chatActions.${id}.hint`)}</small>
          </span>
          <ArrowRight className="starterArrow" size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
