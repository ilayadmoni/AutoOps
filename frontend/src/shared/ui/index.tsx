import { cloneElement, isValidElement, useEffect, useId, useState, type ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, X } from 'lucide-react';
import { ApiError } from '../api/client';
import { useI18n } from '../../i18n/I18nProvider';
import type { Risk } from '../api/types';

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="pageTitle">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="actionsRow">{actions}</div>}
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={20} /> {label ?? t('common.loading')}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Inbox size={28} />
      <strong>{title}</strong>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  if (!error) return null;
  const fields = error instanceof ApiError ? Object.entries(error.fieldErrors) : [];
  return (
    <div className="alert danger" role="alert">
      <AlertTriangle size={18} />
      <div>
        <strong>{errorMessage(error)}</strong>
        {fields.length > 0 && (
          <ul>
            {fields.map(([k, v]) => (
              <li key={k}><code dir="ltr">{k}</code>: {v}</li>
            ))}
          </ul>
        )}
      </div>
      {onRetry && <button className="btn small" onClick={onRetry}>{t('common.retry')}</button>}
    </div>
  );
}

/**
 * The label is linked to its control by id (not by wrapping), so neither option text, hints nor errors become part of
 * the control's accessible name. Hints and errors are attached with aria-describedby.
 */
export function Field({ label, error, hint, children }: { label: ReactNode; error?: string; hint?: ReactNode; children: ReactNode }) {
  const id = useId();
  const describedBy = error || hint ? id + '-desc' : undefined;
  const control = isValidElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>(children)
    ? cloneElement(children, { id: children.props.id ?? id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
    : children;
  return (
    <div className={'field' + (error ? ' invalid' : '')}>
      <label className="fieldLabel" htmlFor={id}>{label}</label>
      {control}
      {error ? <span id={describedBy} className="fieldError" role="alert">{error}</span> : hint ? <span id={describedBy} className="fieldHint">{hint}</span> : null}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modalBackdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="icon" aria-label="close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modalBody">{children}</div>
        {footer && <div className="modalFooter">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, danger, busy, onConfirm, onCancel, acknowledge }: {
  title: ReactNode; message: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onCancel: () => void; acknowledge?: string;
}) {
  const { t } = useI18n();
  const [ack, setAck] = useState(false);
  return (
    <Modal title={title} onClose={onCancel} footer={
      <>
        <button className="btn" onClick={onCancel} disabled={busy}>{t('common.cancel')}</button>
        <button className={'btn ' + (danger ? 'danger' : 'primary')} onClick={onConfirm} disabled={busy || (!!acknowledge && !ack)}>
          {busy && <Loader2 className="spin" size={14} />} {confirmLabel ?? t('common.confirm')}
        </button>
      </>
    }>
      <div className="stack">
        <div>{message}</div>
        {acknowledge && (
          <label className="check danger"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> {acknowledge}</label>
        )}
      </div>
    </Modal>
  );
}

const STATUS_TONE: Record<string, string> = {
  SUCCESS: 'ok', APPROVED: 'ok', TRUSTED: 'ok', COMPLETED: 'ok', ACTIVE: 'ok',
  FAILED: 'bad', REJECTED: 'bad', KEY_CHANGED: 'bad', MISMATCH: 'bad', DISABLED: 'bad',
  PARTIAL: 'warn', WAITING_APPROVAL: 'warn', PENDING: 'warn', READY_FOR_REVIEW: 'warn', UNTRUSTED: 'warn', WARNING: 'warn', EXPIRED: 'muted',
  RUNNING: 'info', PREFLIGHT: 'info', ANALYZING: 'info', IMPORTING: 'info', UPLOADED: 'info',
  CANCELLED: 'muted', SKIPPED: 'muted', NOT_CHECKED: 'muted', NOT_REQUIRED: 'muted',
};

export function StatusBadge({ status }: { status?: string | null }) {
  const { t } = useI18n();
  if (!status) return <span className="badge muted">—</span>;
  return <span className={'badge ' + (STATUS_TONE[status] ?? 'muted')}>{t('status.' + status, undefined, status)}</span>;
}

export function RiskBadge({ risk }: { risk?: Risk | string | null }) {
  const { t } = useI18n();
  if (!risk) return null;
  const tone = risk === 'HIGH' ? 'bad' : risk === 'MEDIUM' ? 'warn' : 'ok';
  return <span className={'badge risk ' + tone}>{risk === 'HIGH' && <AlertTriangle size={12} />} {t('risk.' + risk)}</span>;
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="code" dir="ltr">{children}</code>;
}

export function Output({ label, text, tone }: { label: string; text?: string | null; tone?: 'err' }) {
  if (!text) return null;
  return (
    <div className="output">
      <span className="outputLabel">{label}</span>
      <pre dir="ltr" className={tone === 'err' ? 'err' : ''}>{text}</pre>
    </div>
  );
}

export function Spinner() {
  return <Loader2 className="spin" size={14} />;
}
