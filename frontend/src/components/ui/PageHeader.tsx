import { createContext, useContext, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** The current section's icon, supplied by the app shell from the navigation it already renders. */
export const PageIconContext = createContext<ReactNode>(null);

export type PageBack = { to: string; label: ReactNode; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void };

/**
 * Page header bar: one row, full width, with the section icon (or a breadcrumb back to the parent
 * page), the title and the page's actions, over a hairline. The same bar shape as the assistant's
 * chat header, so every route opens the same way. The subtitle, when given, sits under the bar as
 * the page's opening line.
 */
export default function PageHeader({ title, subtitle, actions, back }: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: PageBack;
}) {
  const icon = useContext(PageIconContext);
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  return (
    <>
      <header className="pageBar">
        {back ? (
          <nav className="pageCrumb" aria-label="breadcrumb">
            <Link to={back.to} onClick={back.onClick}>{back.label}</Link>
            {rtl ? <ChevronLeft size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
          </nav>
        ) : icon && <span className="pageBarIcon" aria-hidden="true">{icon}</span>}
        <h1 className="pageBarTitle">{title}</h1>
        {actions && <div className="pageBarActions">{actions}</div>}
      </header>
      {subtitle && <p className="pageIntro">{subtitle}</p>}
    </>
  );
}
