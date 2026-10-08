import { MessageSquarePlus, Trash2 } from 'lucide-react';
import type { ConversationSummary } from '../../types/api';
import { Button, IconButton } from '../../components';
import { useI18n } from '../../hooks/useI18n';
import { shortDate } from '../../utils/format';

/** Conversation history. Hidden below 900px, where the thread takes the full width. */
export default function ConversationRail({ items, activeId, onOpen, onNew, onDelete }: {
  items: ConversationSummary[];
  activeId: number | null;
  onOpen: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
}) {
  const { t, lang } = useI18n();
  return (
    <aside className="convRail">
      <Button variant="primary" icon={<MessageSquarePlus size={16} />} onClick={onNew}>
        {t('ai.newChat')}
      </Button>
      <div className="convRailHead"><h2>{t('ai.history')}</h2></div>
      <div className="convList">
        {items.length === 0 && <p className="convEmpty">{t('ai.noHistory')}</p>}
        {items.map((c) => (
          <div key={c.id} className={'convItem' + (c.id === activeId ? ' active' : '')}>
            <button className="convOpen" onClick={() => onOpen(c.id)} aria-current={c.id === activeId}>
              <span>{c.title}</span>
              {c.updatedAt && <small>{shortDate(c.updatedAt, lang)}</small>}
            </button>
            <IconButton label={t('common.delete')} danger onClick={() => onDelete(c.id)}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        ))}
      </div>
    </aside>
  );
}
