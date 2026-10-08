import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Bot, Server, Workflow, TerminalSquare, History, Settings, Shield, KeyRound, FileUp, Menu, CheckSquare, Users, Database, ScrollText } from 'lucide-react';
import { Brand, IconButton } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { usePendingApprovals } from '../../hooks/usePendingApprovals';
import SidebarFooter from './SidebarFooter';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pending = usePendingApprovals(false, 15000);
  const link = (to: string, icon: ReactNode, label: string, badge?: number) => (
    <NavLink to={to} end={to === '/'} onClick={() => setOpen(false)}>
      {icon}<span>{label}</span>{badge ? <span className="navBadge">{badge}</span> : null}
    </NavLink>
  );
  return (
    <div className={'shell' + (open ? ' navOpen' : '')}>
      <header className="topbar">
        <IconButton label="Menu" onClick={() => setOpen(!open)}><Menu /></IconButton>
        <Brand size={22} />
      </header>
      <aside>
        <Brand size={28} />
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
          {link('/settings', <Settings />, t('nav.settings'))}
        </nav>
        <SidebarFooter />
      </aside>
      <main>{children}</main>
    </div>
  );
}
