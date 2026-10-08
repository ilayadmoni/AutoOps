import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  /** Visible text. The input sits inside the label, so the whole row is the hit target. */
  label?: ReactNode;
  /** Red text for an acknowledgement the user must read before a destructive action. */
  danger?: boolean;
  /** Bordered row. Use in lists of choices, where the selected row should read as a whole. */
  boxed?: boolean;
};

function Checkable({ type, label, danger, boxed, className, indeterminate, ...rest }:
BaseProps & { type: 'checkbox' | 'radio'; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  // `indeterminate` exists only as a DOM property; there is no attribute for it.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  const classes = ['check', boxed ? 'boxed' : '', danger ? 'danger' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <label className={classes}>
      <input ref={ref} type={type} {...rest} />
      {label !== undefined && <span>{label}</span>}
    </label>
  );
}

/** Checkbox for form state that is saved with the surrounding form. */
export default function Checkbox(props: BaseProps & { indeterminate?: boolean }) {
  return <Checkable type="checkbox" {...props} />;
}

/** Radio. Give every member of a group the same `name` so the browser handles arrow keys. */
export function Radio(props: BaseProps) {
  return <Checkable type="radio" {...props} />;
}

/**
 * Switch for a setting that takes effect the moment it is flipped. Anything that only takes
 * effect on save is a checkbox; keeping that split is what makes either control predictable.
 */
export function Switch({ label, className, ...rest }: Omit<BaseProps, 'boxed' | 'danger'>) {
  const input = (
    <span className="switch">
      <input type="checkbox" role="switch" {...rest} />
    </span>
  );
  if (label === undefined) return input;
  return (
    <label className={['check', className ?? ''].filter(Boolean).join(' ')}>
      {input}
      <span>{label}</span>
    </label>
  );
}
