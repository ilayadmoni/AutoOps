import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bot, Server, Workflow, TerminalSquare, History, Shield, KeyRound, FileUp, Menu, Users, Database, ScrollText } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { useI18n } from '../providers/I18nProvider';
import { Brand, IconButton, PageIconContext } from '../../components/ui';
import SidebarFooter from './SidebarFooter';
import AppControls from '../../components/AppControls';

/** Section icons, longest prefix first, so a detail route takes its parent section's icon. */
const SECTION_ICONS: [string, ReactNode][] = [
  ['/admin/users', <Users />], ['/admin/datasets', <Database />],
  ['/admin/audit', <ScrollText />], ['/admin', <Shield />], ['/workflows', <Workflow />], ['/commands', <TerminalSquare />],
  ['/machines', <Server />], ['/credentials', <KeyRound />], ['/files', <FileUp />], ['/executions', <History />],
  ['/', <Bot />],
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const sectionIcon = SECTION_ICONS.find(([p]) => p === '/' ? pathname === '/' : pathname.startsWith(p))?.[1] ?? null;
  const link = (to: string, icon: ReactNode, label: string) => (
    <NavLink to={to} end={to === '/' || to === '/admin'} onClick={() => setOpen(false)}>
      {icon}<span>{label}</span>
    </NavLink>
  );
  return (
    <div className={'shell' + (open ? ' navOpen' : '')}>
      <header className="topbar">
        <IconButton label={t('nav.menu')} onClick={() => setOpen(!open)} aria-expanded={open}><Menu size={20} /></IconButton>
        <Brand size={22} />
        <AppControls />
      </header>
      <aside className="sidebar">
        <Brand size={26} />
        <nav>
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
            {link('/admin/users', <Users />, t('nav.users'))}
            {link('/admin/datasets', <Database />, t('nav.datasets'))}
            {link('/admin/audit', <ScrollText />, t('nav.audit'))}
          </>)}
        </nav>
        <SidebarFooter />
      </aside>
      {open && <div className="navScrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <main>
        <div className="appFloat"><AppControls /></div>
        <PageIconContext.Provider value={sectionIcon}>
          <div className="mainBody">{children}</div>
        </PageIconContext.Provider>
      </main>
    </div>
  );
}
