import { PanelRightClose, PanelLeftClose, Trash2 } from 'lucide-react';
import type { ConversationSummary } from '../../types/api';
import { IconButton, ListItem } from '../../components/ui';
import { useI18n } from '../../app/providers/I18nProvider';
import { shortDate } from '../../utils/format';

/**
 * Conversation history. The user hides it from its own header or from the chat bar; the choice is
 * remembered per device. It also folds away by itself while the workflow canvas is open.
 */
export default function ConversationRail({ items, loading, activeId, onOpen, onDelete, onCollapse }: {
  items: ConversationSummary[];
  loading?: boolean;
  activeId: number | null;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
  onCollapse: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <aside className="convRail" aria-label={t('ai.history')}>
      <div className="convRailHead">
        <h2>{t('ai.history')}</h2>
        <IconButton label={t('ai.hideHistory')} onClick={onCollapse}>
          {lang === 'he' ? <PanelRightClose size={16} /> : <PanelLeftClose size={16} />}
        </IconButton>
      </div>
      <div className="convList">
        {loading && [0, 1, 2].map((i) => <span key={i} className="skeletonBlock convSkeleton" />)}
        {!loading && items.length === 0 && <p className="convEmpty">{t('ai.noHistory')}</p>}
        {items.map((c) => (
          <ListItem
            key={c.id}
            label={c.title}
            meta={c.updatedAt ? shortDate(c.updatedAt, lang) : undefined}
            active={c.id === activeId}
            onClick={() => onOpen(c.id)}
            actions={(
              <IconButton label={t('common.delete')} danger onClick={() => onDelete(c.id)}>
                <Trash2 size={14} />
              </IconButton>
            )}
          />
        ))}
      </div>
    </aside>
  );
}
