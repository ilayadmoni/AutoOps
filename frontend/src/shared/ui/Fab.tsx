import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Spinner } from './Loaders';
import Tooltip from './Tooltip';

/**
 * Floating action button: the page's one "add" action, as a round button pinned to the bottom
 * corner opposite the navigation (bottom-left under RTL, bottom-right in LTR). It is portalled to
 * the body so no scrolling or contained ancestor can carry it away. `label` is its accessible
 * name and its tooltip. Pass `to` for navigation, `onClick` for an in-page action.
 */
export default function Fab({ label, onClick, to, busy, icon }: {
  label: string;
  onClick?: () => void;
  to?: string;
  busy?: boolean;
  icon?: ReactNode;
}) {
  const content = busy ? <Spinner tone="ink" /> : icon ?? <Plus size={24} strokeWidth={2.25} />;
  const button = to
    ? <Link to={to} className="fab" aria-label={label}>{content}</Link>
    : (
      <button type="button" className="fab" aria-label={label} aria-busy={busy || undefined} disabled={busy} onClick={onClick}>
        {content}
      </button>
    );
  return createPortal(<Tooltip text={label} side="top" describe={false}>{button}</Tooltip>, document.body);
}
