import { Check, FileText, Server, X } from 'lucide-react';
import { ErrorAlert, IconButton } from '../../components/ui';
import { useI18n } from '../../app/providers/I18nProvider';
import { useMentionCopy } from './mentionCopy';
import type { useComposerMentions } from './useComposerMentions';

export default function MentionPicker({ picker }: { picker: ReturnType<typeof useComposerMentions> }) {
  const { t } = useI18n();
  const copy = useMentionCopy();
  if (!picker.mention) return null;
  const isServer = picker.mention.symbol === '@';
  const Icon = isServer ? Server : FileText;
  const title = isServer ? copy.serverTitle : copy.fileTitle;
  return (
    <div className="mentionPicker">
      <div className="mentionHead"><Icon size={16} /><strong>{title}</strong>
        <small>{picker.mention.query || copy.search}</small>
        <IconButton label={t('common.close')} onClick={picker.close}><X size={14} /></IconButton>
      </div>
      {picker.query.isLoading && <p className="mentionNotice" role="status">{t('common.loading')}</p>}
      <ErrorAlert error={picker.query.error} onRetry={() => picker.query.refetch()} />
      {picker.atLimit && <p className="mentionNotice" role="status">{copy.limit}</p>}
      <div id={picker.id} role="listbox" aria-label={title} className="mentionOptions">
        {picker.options.map((option, index) => (
          <button type="button" role="option" id={`${picker.id}-${index}`} key={option.id} tabIndex={-1}
            aria-selected={index === picker.activeIndex} aria-disabled={option.disabled}
            className={'mentionOption' + (index === picker.activeIndex ? ' active' : '')}
            onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => picker.setActive(index)}
            onClick={() => picker.select(option)}>
            <Icon size={17} /><span><strong dir="auto">{option.label}</strong>
              <small dir="ltr">{option.detail} · #{option.id}</small></span>
            {option.selected && <span className="mentionSelected"><Check size={14} />{copy.selected}</span>}
          </button>
        ))}
      </div>
      {!picker.query.isLoading && !picker.query.error && !picker.options.length
        && <p className="mentionNotice" role="status">{isServer ? copy.emptyServers : copy.emptyFiles}</p>}
      <footer>{copy.keys}</footer>
    </div>
  );
}
