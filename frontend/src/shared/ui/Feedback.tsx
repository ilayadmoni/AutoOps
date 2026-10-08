import { cloneElement, isValidElement, useId, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Inbox } from 'lucide-react';
import { ApiError } from '../api/client';
import Button from './Button';
import { useI18n } from '../../i18n/I18nProvider';

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
      <div className="grow">
        <strong>{errorMessage(error)}</strong>
        {fields.length > 0 && (
          <ul>
            {fields.map(([k, v]) => (
              <li key={k}><code dir="ltr">{k}</code>: {v}</li>
            ))}
          </ul>
        )}
      </div>
      {onRetry && <Button small onClick={onRetry}>{t('common.retry')}</Button>}
    </div>
  );
}

/**
 * The label is linked to its control by id (not by wrapping), so neither option text, hints nor
 * errors become part of the control's accessible name. Hints and errors attach via aria-describedby.
 *
 * A field shows a hint or an error, never both: once something is wrong, the correction is the
 * only thing worth the line.
 */
export function Field({ label, error, hint, required, children }: {
  label: ReactNode; error?: string; hint?: ReactNode; required?: boolean; children: ReactNode;
}) {
  const generated = useId();
  const valid = isValidElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>(children);
  const id = (valid && children.props.id) || generated;
  const describedBy = error || hint ? id + '-desc' : undefined;
  const control = valid
    ? cloneElement(children, {
      id,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : undefined,
    })
    : children;
  return (
    <div className={'field' + (error ? ' invalid' : '')}>
      <label className="fieldLabel" id={id + '-label'} htmlFor={id}>
        {label}
        {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {control}
      {error
        ? <span id={describedBy} className="fieldError" role="alert"><AlertCircle size={13} />{error}</span>
        : hint ? <span id={describedBy} className="fieldHint">{hint}</span> : null}
    </div>
  );
}

/** Inline technical value. An empty value renders as a muted dash rather than an empty chip. */
export function Code({ children }: { children: ReactNode }) {
  if (children == null || children === '' || children === false) return <span className="muted">—</span>;
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
