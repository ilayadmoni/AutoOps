import { KeyRound, Play, Server, TerminalSquare, Workflow } from 'lucide-react';
import { Tile } from '../../components/ui';
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
        <Tile key={id} icon={<Icon aria-hidden="true" />} title={t(`chatActions.${id}.title`)}
          hint={t(`chatActions.${id}.hint`)} disabled={disabled}
          onClick={() => onChoose(t(`chatActions.${id}.prompt`))} />
      ))}
    </div>
  );
}
