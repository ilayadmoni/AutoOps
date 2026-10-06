import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, Server, Workflow, TerminalSquare, History, Settings, Shield, KeyRound, FileUp, LogOut, Menu, CheckSquare, Users, Database, ScrollText } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { get } from '../shared/api/client';
import type { ApprovalView } from '../shared/api/types';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const pending = useQuery({ queryKey: ['approvals', 'pending', false], queryFn: () => get<ApprovalView[]>('/approvals/pending'), refetchInterval: 15000 });
  const link = (to: string, icon: ReactNode, label: string, badge?: number) => (
    <NavLink to={to} end={to === '/'} onClick={() => setOpen(false)}>
      {icon}<span>{label}</span>{badge ? <span className="navBadge">{badge}</span> : null}
    </NavLink>
  );
  return (
    <div className={'shell' + (open ? ' navOpen' : '')}>
      <header className="topbar">
        <button className="icon" aria-label="menu" onClick={() => setOpen(!open)}><Menu /></button>
        <div className="brand">Auto<span>Ops</span></div>
      </header>
      <aside>
        <div className="brand">Auto<span>Ops</span></div>
        <nav>
          {link('/', <Bot />, t('nav.assistant'))}
          {link('/workflows', <Workflow />, t('nav.workflows'))}
          {link('/commands', <TerminalSquare />, t('nav.commands'))}
          {link('/machines', <Server />, t('nav.machines'))}
          {link('/credentials', <KeyRound />, t('nav.credentials'))}
          {link('/files', <FileUp />, t('nav.files'))}
          {link('/executions', <History />, t('nav.executions'))}
          {link('/approvals', <CheckSquare />, t('nav.approvals'), pending.data?.length)}
          {isAdmin && (
            <>
              <div className="navSection">{t('nav.admin')}</div>
              {link('/admin', <Shield />, t('nav.adminOverview'))}
              {link('/admin/users', <Users />, t('nav.users'))}
              {link('/admin/commands', <TerminalSquare />, t('nav.commandApprovals'))}
              {link('/admin/datasets', <Database />, t('nav.datasets'))}
              {link('/admin/audit', <ScrollText />, t('nav.audit'))}
            </>
          )}
          {link('/settings', <Settings />, t('nav.settings'))}
        </nav>
        <div className="userBox">
          <div>
            <strong dir="ltr">{user?.username}</strong>
            <small className="muted">{t('role.' + user?.role)}</small>
          </div>
          <div className="row gap">
            <button className="btn small ghost" onClick={() => setLang(lang === 'en' ? 'he' : 'en')}>{lang === 'en' ? 'עברית' : 'English'}</button>
            <button className="btn small ghost" onClick={logout} title={t('nav.logout')}><LogOut size={16} /> {t('nav.logout')}</button>
          </div>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
