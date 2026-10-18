import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bot, Server, Workflow, TerminalSquare, History, Shield, KeyRound, FileUp, Menu, Users, Database, ScrollText, Settings, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { useI18n } from '../providers/I18nProvider';
import { Brand, IconButton, PageIconContext, Tooltip } from '../../components/ui';
import SidebarFooter from './SidebarFooter';
import AppControls from '../../components/AppControls';
import { useMobileNavigation } from './useMobileNavigation';
import { useSidebarPreference } from './useSidebarPreference';

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
  const { t, dir } = useI18n();
  const sidebar = useSidebarPreference();
  const [open, setOpen] = useState(false);
  const mobileOpen = useMobileNavigation(open, () => setOpen(false));
  const compact = sidebar.collapsed && !mobileOpen;
  const { pathname } = useLocation();
  const sectionIcon = SECTION_ICONS.find(([p]) => p === '/' ? pathname === '/' : pathname.startsWith(p))?.[1] ?? null;
  const link = (to: string, icon: ReactNode, label: string) => {
    const item = <NavLink to={to} aria-label={label} end={to === '/' || to === '/admin'} onClick={() => setOpen(false)}>
      <span className="sidebarNavIcon" aria-hidden="true">{icon}</span><span className="sidebarNavLabel">{label}</span>
    </NavLink>;
    return compact ? <Tooltip text={label} side={dir === 'rtl' ? 'left' : 'right'} describe={false}>{item}</Tooltip> : item;
  };
  return (
    <div className={'shell' + (mobileOpen ? ' navOpen' : '') + (sidebar.collapsed ? ' sidebarCollapsed' : '')}>
      <a className="skipLink" href="#main-content">{t('nav.skip')}</a>
      <header className="topbar">
        <IconButton label={t('nav.menu')} onClick={() => setOpen(!open)} aria-expanded={mobileOpen} aria-controls="app-sidebar"><Menu size={24} /></IconButton>
        <Brand size={22} />
        <AppControls />
      </header>
      <aside id="app-sidebar" className="sidebar" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined} aria-label={t('nav.main')}>
        <IconButton className="sidebarClose" label={t('common.close')} onClick={() => setOpen(false)}><X size={18} /></IconButton>
        <div className="sidebarHeader">
          <Brand size={30} compact={compact} />
          <IconButton className="sidebarToggle" label={t(sidebar.collapsed ? 'nav.expand' : 'nav.collapse')}
            aria-expanded={!sidebar.collapsed} aria-controls="primary-navigation" onClick={sidebar.toggle}>
            {sidebar.collapsed ? <PanelLeftOpen size={22} aria-hidden="true" /> : <PanelLeftClose size={22} aria-hidden="true" />}
          </IconButton>
        </div>
        <nav id="primary-navigation" aria-label={t('nav.main')}>
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
        <SidebarFooter compact={compact} />
      </aside>
      {mobileOpen && <div className="navScrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <main id="main-content" tabIndex={-1}>
        <div className="appFloat"><AppControls /></div>
        <PageIconContext.Provider value={sectionIcon}>
          <div className="mainBody">{children}</div>
        </PageIconContext.Provider>
      </main>
    </div>
  );
}
