import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { useI18n } from '../../app/providers/I18nProvider';
import { useModalFocus } from './useModalFocus';

/**
 * Dialog with Escape-to-close and a focus trap. Focus moves into the dialog on open and
 * returns to the invoking element on close, so keyboard users are never dropped at the page top.
 */
export default function Modal({ title, onClose, children, footer, wide }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { t } = useI18n();
  useModalFocus(dialog, onClose);
  return createPortal(
    <div className="modalBackdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        tabIndex={-1}
        className={'modal' + (wide ? ' wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modalHeader">
          <h2 id={titleId}>{title}</h2>
          <IconButton label={t('common.close')} onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="modalBody">{children}</div>
        {footer && <div className="modalFooter">{footer}</div>}
      </div>
    </div>, document.body,
  );
}
