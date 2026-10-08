import type { ReactNode } from 'react';

/** Surface container. `onClick` turns it into a real button so keyboard users get it too. */
export default function Card({ children, className, tone, onClick, label }: {
  children: ReactNode;
  className?: string;
  tone?: string;
  onClick?: () => void;
  label?: string;
}) {
  const classes = ['card', tone ?? '', onClick ? 'interactive' : '', className ?? ''].filter(Boolean).join(' ');
  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={label}>
        {children}
      </button>
    );
  }
  return <div className={classes}>{children}</div>;
}

export function CardHeader({ title, meta, actions }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="cardHeader">
      <div className="stack tight grow">
        <strong>{title}</strong>
        {meta && <small className="muted">{meta}</small>}
      </div>
      {actions}
    </div>
  );
}

/** Labelled metric. Large numerals, muted caption. */
export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card stat">
      <small className="muted">{label}</small>
      <strong>{value}</strong>
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}
