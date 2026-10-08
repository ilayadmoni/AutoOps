import type { NodeType } from '../../../types/api';
import { Tile } from '../../../components/ui';
import { STEP_ICON, STEP_TYPES } from '../../../components/ui/flow';
import { useI18n } from '../../../app/providers/I18nProvider';

const TONE = { COMMAND: 'primary', FILE_TRANSFER: 'info', WAIT_UNTIL: 'warn' } as const;

/** Step library. Click adds to the canvas after the last step and selects it for editing. */
export default function NodePalette({ onAdd }: { onAdd: (type: NodeType) => void }) {
  const { t } = useI18n();
  return (
    <div className="palette">
      <span className="paletteLabel">{t('workflows.addStep')}</span>
      {STEP_TYPES.map((type) => {
        const Icon = STEP_ICON[type];
        return (
          <Tile key={type} icon={<Icon />} tone={TONE[type]} title={t('steps.' + type)} hint={t('stepHints.' + type)} onClick={() => onAdd(type)} />
        );
      })}
      <p className="paletteHint">{t('workflows.canvasHint')}</p>
    </div>
  );
}
