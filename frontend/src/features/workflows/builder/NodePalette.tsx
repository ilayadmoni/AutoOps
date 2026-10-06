import { Clock, FileUp, TerminalSquare } from 'lucide-react';
import type { NodeType } from '../../../shared/api/types';
import { useI18n } from '../../../i18n/I18nProvider';

const ITEMS: { type: NodeType; icon: typeof Clock }[] = [
  { type: 'COMMAND', icon: TerminalSquare },
  { type: 'FILE_TRANSFER', icon: FileUp },
  { type: 'WAIT_UNTIL', icon: Clock },
];

/** Step library. Click adds to the canvas and selects the new step for editing. */
export default function NodePalette({ onAdd }: { onAdd: (type: NodeType) => void }) {
  const { t } = useI18n();
  return (
    <div className="palette">
      <span className="paletteLabel">{t('workflows.addStep')}</span>
      {ITEMS.map(({ type, icon: Icon }) => (
        <button key={type} type="button" className="paletteItem" onClick={() => onAdd(type)}>
          <span className="paletteIcon"><Icon size={16} /></span>
          <span className="grow">
            <strong>{t('steps.' + type)}</strong>
            <small>{t('stepHints.' + type)}</small>
          </span>
        </button>
      ))}
      <p className="muted small">{t('workflows.canvasHint')}</p>
    </div>
  );
}
