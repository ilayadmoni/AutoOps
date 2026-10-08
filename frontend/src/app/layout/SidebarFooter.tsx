import { LogOut } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { IconButton } from '../../components/ui';
import { useI18n } from '../providers/I18nProvider';

/** Who is signed in, with sign-out beside it. Device preferences live in the top corner (AppControls). */
export default function SidebarFooter() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const initial = user?.username?.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="sidebarFooter">
      <div className="sidebarIdentity">
        <span className="userAvatar" aria-hidden="true">{initial}</span>
        <span className="userDetails">
          <strong dir="ltr">{user?.username}</strong>
          <small>{t('role.' + user?.role)}</small>
        </span>
        <IconButton label={t('nav.logout')} onClick={logout}>
          <LogOut size={16} />
        </IconButton>
      </div>
    </div>
  );
}
