import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, Server, Workflow, TerminalSquare, History, Settings, Shield, KeyRound, FileUp, Menu, CheckSquare, Users, Database, ScrollText } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { Brand, IconButton, PageIconContext } from '../shared/ui';
import { get } from '../shared/api/client';
import type { ApprovalView } from '../shared/api/types';
import SidebarFooter from './SidebarFooter';
import AppControls from './AppControls';

/** Section icons, longest prefix first, so a detail route takes its parent section's icon. */
const SECTION_ICONS: [string, ReactNode][] = [
  ['/admin/users', <Users />], ['/admin/commands', <TerminalSquare />], ['/admin/datasets', <Database />],
  ['/admin/audit', <ScrollText />], ['/admin', <Shield />], ['/workflows', <Workflow />], ['/commands', <TerminalSquare />],
  ['/machines', <Server />], ['/credentials', <KeyRound />], ['/files', <FileUp />], ['/executions', <History />],
  ['/approvals', <CheckSquare />], ['/settings', <Settings />], ['/', <Bot />],
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const sectionIcon = SECTION_ICONS.find(([p]) => p === '/' ? pathname === '/' : pathname.startsWith(p))?.[1] ?? null;
  const pending = useQuery({ queryKey: ['approvals', 'pending', false], queryFn: () => get<ApprovalView[]>('/approvals/pending'), refetchInterval: 15000 });
  const link = (to: string, icon: ReactNode, label: string, badge?: number) => (
    <NavLink to={to} end={to === '/' || to === '/admin'} onClick={() => setOpen(false)}>
      {icon}<span>{label}</span>{badge ? <span className="navBadge">{badge}</span> : null}
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
          {link('/approvals', <CheckSquare />, t('nav.approvals'), pending.data?.length)}
          {isAdmin && (<>
            <div className="navSection">{t('nav.admin')}</div>
            {link('/admin', <Shield />, t('nav.adminOverview'))}
            {link('/admin/users', <Users />, t('nav.users'))}
            {link('/admin/commands', <TerminalSquare />, t('nav.commandApprovals'))}
            {link('/admin/datasets', <Database />, t('nav.datasets'))}
            {link('/admin/audit', <ScrollText />, t('nav.audit'))}
          </>)}
          {/* Language and theme live in the top pill, so Settings only carries admin value. */}
          {isAdmin && link('/settings', <Settings />, t('nav.settings'))}
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
