import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from './Loaders';
import Tooltip from './Tooltip';

type Variant = 'default' | 'primary' | 'danger' | 'ghost';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  variant?: Variant;
  small?: boolean;
  block?: boolean;
  /** Shows a spinner and blocks input; the label stays so the button keeps its width. */
  busy?: boolean;
  icon?: ReactNode;
  /** Themed tooltip. Shown even while disabled, which is when an explanation matters most. */
  hint?: string;
};

/**
 * Disabled buttons receive no pointer events, so a hint on one is hosted by a wrapper span that
 * does. The wrapper is inline-flex and adds no box of its own.
 */
function withHint(button: ReactNode, hint: string | undefined, disabled: boolean | undefined) {
  if (!hint) return button;
  if (!disabled) return <Tooltip text={hint}>{button as ReactElement}</Tooltip>;
  return <Tooltip text={hint}><span className="tipHost" tabIndex={0}>{button}</span></Tooltip>;
}

/**
 * The single button in the system. `busy` disables the control itself rather than relying on
 * callers to remember, which is what keeps double-submits out of the execution engine.
 */
export default function Button({
  variant = 'default', small, block, busy, icon, hint, children, className, disabled, type = 'button', ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' ? variant : '',
    small ? 'small' : '',
    block ? 'block' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  const off = disabled || busy;
  return withHint(
    <button type={type} className={classes} disabled={off} aria-busy={busy || undefined} {...rest}>
      {busy ? <Spinner tone={variant === 'primary' ? 'ink' : 'accent'} /> : icon}
      {children}
    </button>,
    hint,
    off,
  );
}

/**
 * Icon-only button. `label` is required because there is no visible text to name it; it is also
 * the tooltip, so sighted pointer users get the same name a screen reader announces.
 * `hint` replaces the tooltip text when the action needs an explanation (e.g. why it is disabled).
 */
export function IconButton({ label, hint, children, danger, className, type = 'button', disabled, ...rest }:
Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & { label: string; hint?: string; danger?: boolean }) {
  const button = (
    <button
      type={type}
      className={['icon', danger ? 'danger' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-label={label}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
  if (disabled) return <Tooltip text={hint ?? label}><span className="tipHost">{button}</span></Tooltip>;
  return <Tooltip text={hint ?? label} describe={!!hint && hint !== label}>{button}</Tooltip>;
}

/** Navigation styled as a Button. Use for actions that go to another page (a link, not a command). */
export function ButtonLink({ to, variant = 'default', small, icon, children }: {
  to: string;
  variant?: Variant;
  small?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const classes = ['btn', variant !== 'default' ? variant : '', small ? 'small' : ''].filter(Boolean).join(' ');
  return <Link to={to} className={classes}>{icon}{children}</Link>;
}
