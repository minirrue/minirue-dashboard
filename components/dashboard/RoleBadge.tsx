import { isRole, roleLabel, type Role } from '@/lib/auth/role';

export interface RoleBadgeProps {
  role?: string;
  /** compact = sidebar/footer; default = topbar */
  size?: 'compact' | 'default';
}

const ROLE_TONE: Record<Role, 'owner' | 'admin' | 'staff' | 'customer'> = {
  // Keeps the owner tone deliberately: a colour of its own would advertise the
  // reset capability on every screen. (OWNER and DEV were retired by backend
  // migration 0014; the 'owner' and 'dev' tones remain as style names only.)
  SUPERADMIN: 'owner',
  ADMIN: 'admin',
  STAFF: 'staff',
  COLLAB: 'staff',
  CUSTOMER: 'customer',
};

export default function RoleBadge({ role, size = 'default' }: RoleBadgeProps) {
  if (!role || !isRole(role)) return null;

  return (
    <span
      className={`dash-role-badge dash-role-badge--${ROLE_TONE[role]} dash-role-badge--${size}`}
      title={`Signed in as ${roleLabel(role)}`}
    >
      {roleLabel(role)}
    </span>
  );
}
