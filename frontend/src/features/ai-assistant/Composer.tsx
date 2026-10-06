import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

/**
 * Message composer. Enter sends, Shift+Enter inserts a newline — the convention operators
 * already expect from chat tools. The textarea grows with its content up to a CSS max-height.
 */
export default function Composer({ value, onChange, onSubmit, disabled, busy }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const canSend = !!value.trim() && !busy && !disabled;
  return (
    <div className="composerWrap">
      <form
        className="composer"
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      >
        <textarea
          ref={area}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('ai.placeholder')}
          maxLength={4000}
          disabled={disabled}
          aria-label={t('ai.placeholder')}
        />
        <div className="composerBar">
          <span className="composerHint">
            <kbd>Enter</kbd> {t('ai.hintSend')} · <kbd>Shift</kbd>+<kbd>Enter</kbd> {t('ai.hintNewline')}
          </span>
          <button className="composerSend" type="submit" disabled={!canSend} aria-label={t('ai.send')}>
            <ArrowUp size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
