import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bot, Server, Workflow, TerminalSquare, History, Shield, KeyRound, FileUp, Menu, Users, Database, ScrollText, Settings, X } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { useI18n } from '../providers/I18nProvider';
import { Brand, IconButton, PageIconContext } from '../../components/ui';
import SidebarFooter from './SidebarFooter';
import AppControls from '../../components/AppControls';
import { useMobileNavigation } from './useMobileNavigation';

/** Section icons, longest prefix first, so a detail route takes its parent section's icon. */
const SECTION_ICONS: [string, ReactNode][] = [
  ['/admin/users', <Users />], ['/admin/datasets', <Database />],
  ['/admin/environment', <Settings />],
  ['/admin/audit', <ScrollText />], ['/admin', <Shield />], ['/workflows', <Workflow />], ['/commands', <TerminalSquare />],
  ['/machines', <Server />], ['/credentials', <KeyRound />], ['/files', <FileUp />], ['/executions', <History />],
  ['/', <Bot />],
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const mobileOpen = useMobileNavigation(open, () => setOpen(false));
  const { pathname } = useLocation();
  const sectionIcon = SECTION_ICONS.find(([p]) => p === '/' ? pathname === '/' : pathname.startsWith(p))?.[1] ?? null;
  const link = (to: string, icon: ReactNode, label: string) => (
    <NavLink to={to} end={to === '/' || to === '/admin'} onClick={() => setOpen(false)}>
      {icon}<span>{label}</span>
    </NavLink>
  );
  return (
    <div className={'shell' + (open ? ' navOpen' : '')}>
      <a className="skipLink" href="#main-content">{t('nav.skip')}</a>
      <header className="topbar">
        <IconButton label={t('nav.menu')} onClick={() => setOpen(!open)} aria-expanded={open}><Menu size={20} /></IconButton>
        <Brand size={22} />
        <AppControls />
      </header>
      <aside className="sidebar" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined} aria-label={t('nav.main')}>
        <IconButton className="sidebarClose" label={t('common.close')} onClick={() => setOpen(false)}><X size={18} /></IconButton>
        <Brand size={26} />
        <nav aria-label={t('nav.main')}>
          {link('/', <Bot />, t('nav.assistant'))}
          {link('/workflows', <Workflow />, t('nav.workflows'))}
          {link('/commands', <TerminalSquare />, t('nav.commands'))}
          {link('/machines', <Server />, t('nav.machines'))}
          {link('/credentials', <KeyRound />, t('nav.credentials'))}
          {link('/files', <FileUp />, t('nav.files'))}
          {link('/executions', <History />, t('nav.executions'))}
          {isAdmin && (<>
            <div className="navSection">{t('nav.admin')}</div>
            {link('/admin', <Shield />, t('nav.adminOverview'))}
            {link('/admin/environment', <Settings />, t('environment.title'))}
            {link('/admin/users', <Users />, t('nav.users'))}
            {link('/admin/datasets', <Database />, t('nav.datasets'))}
            {link('/admin/audit', <ScrollText />, t('nav.audit'))}
          </>)}
        </nav>
        <SidebarFooter />
      </aside>
      {open && <div className="navScrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <main id="main-content" tabIndex={-1}>
        <div className="appFloat"><AppControls /></div>
        <PageIconContext.Provider value={sectionIcon}>
          <div className="mainBody">{children}</div>
        </PageIconContext.Provider>
      </main>
    </div>
  );
}
