import { LogOut } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { Avatar, IconButton, Tooltip } from '../../components/ui';
import { useI18n } from '../providers/I18nProvider';

/** Who is signed in, with sign-out beside it. Device preferences live in the top corner (AppControls). */
export default function SidebarFooter({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const { t, dir } = useI18n();
  const identity = `${user?.username ?? ''} · ${t('role.' + user?.role)}`;

  return (
    <div className="sidebarFooter">
      <div className="userCard">
        <Tooltip text={identity} side={dir === 'rtl' ? 'left' : 'right'} describe={false}>
          <span className="sidebarAvatar" role="img" aria-label={identity} tabIndex={compact ? 0 : undefined}>
            <Avatar name={user?.username} size={40} status="online" />
          </span>
        </Tooltip>
        <span className="userDetails">
          <strong dir="ltr">{user?.username}</strong>
          <span className={'roleChip' + (user?.role === 'ADMIN' ? ' admin' : '')}>{t('role.' + user?.role)}</span>
        </span>
        <IconButton className="signOut" label={t('nav.logout')} onClick={logout}>
          <LogOut size={20} />
        </IconButton>
      </div>
    </div>
  );
}
