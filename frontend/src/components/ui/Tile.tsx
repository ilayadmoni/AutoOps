import type { ReactNode } from 'react';

/**
 * Clickable tile: icon, title and an optional one-line hint. Used for choice lists such as the
 * step palette and the assistant's starter prompts. `tone` colours the icon with a status token,
 * so a tile can carry the same type colour it has elsewhere (e.g. on the canvas).
 */
export default function Tile({ icon, title, hint, tone, onClick, className }: {
  icon: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  tone?: 'primary' | 'info' | 'warn';
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={['tile', tone ? 'tone-' + tone : '', className ?? ''].filter(Boolean).join(' ')} onClick={onClick}>
      <span className="tileIcon">{icon}</span>
      <span className="tileText">
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </button>
  );
}

/**
 * Selectable list row with trailing actions that reveal on hover or focus, e.g. conversation
 * history. The row's main button carries `aria-current` when active.
 */
export function ListItem({ label, meta, active, onClick, actions }: {
  label: ReactNode;
  meta?: ReactNode;
  active?: boolean;
  onClick: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className={'listItem' + (active ? ' active' : '')}>
      <button type="button" className="listItemMain" onClick={onClick} aria-current={active || undefined}>
        <span>{label}</span>
        {meta && <small>{meta}</small>}
      </button>
      {actions && <span className="listItemActions">{actions}</span>}
    </div>
  );
}
