import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Loaders';

type Variant = 'default' | 'primary' | 'danger' | 'ghost';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  small?: boolean;
  block?: boolean;
  /** Shows a spinner and blocks input; the label stays so the button keeps its width. */
  busy?: boolean;
  icon?: ReactNode;
};

/**
 * The single button in the system. `busy` disables the control itself rather than relying on
 * callers to remember, which is what keeps double-submits out of the execution engine.
 */
export default function Button({
  variant = 'default', small, block, busy, icon, children, className, disabled, type = 'button', ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' ? variant : '',
    small ? 'small' : '',
    block ? 'block' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <Spinner tone={variant === 'primary' ? 'ink' : 'accent'} /> : icon}
      {children}
    </button>
  );
}

/** Icon-only button. `label` is required because there is no visible text to name it. */
export function IconButton({ label, children, danger, className, type = 'button', ...rest }:
ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return (
    <button
      type={type}
      className={['icon', danger ? 'danger' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}
