import { LogOut } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { Avatar, IconButton } from '../../components/ui';
import { useI18n } from '../providers/I18nProvider';

/** Who is signed in, with sign-out beside it. Device preferences live in the top corner (AppControls). */
export default function SidebarFooter() {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  return (
    <div className="sidebarFooter">
      <div className="userCard">
        <Avatar name={user?.username} status="online" />
        <span className="userDetails">
          <strong dir="ltr">{user?.username}</strong>
          <span className={'roleChip' + (user?.role === 'ADMIN' ? ' admin' : '')}>{t('role.' + user?.role)}</span>
        </span>
        <IconButton className="signOut" label={t('nav.logout')} onClick={logout}>
          <LogOut size={16} />
        </IconButton>
      </div>
    </div>
  );
}
