/**
 * Canonical RBAC role vocabulary — mirrors
 * `apps/minirue-backend/src/common/enums/role.enum.ts`.
 *
 * Five roles. DEV and OWNER were retired by backend migration 0014: DEV was an
 * environment bypass rather than a real account, and OWNER vs ADMIN was a
 * distinction nobody using the dashboard could explain. Existing DEV accounts
 * became SUPERADMIN, existing OWNER accounts became ADMIN.
 */

export const Role = {
  /** Top of the tree. Reaches every screen, and is the only role that can
   *  manage accounts or erase shop data. */
  SUPERADMIN: 'SUPERADMIN',
  /** Runs the shop day to day. */
  ADMIN: 'ADMIN',
  /** Customer-support channel only. */
  STAFF: 'STAFF',
  /** Brand partner, sees only their own portal. */
  COLLAB: 'COLLAB',
  /** Storefront shopper. Never reaches the dashboard. */
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_VALUES: readonly Role[] = Object.values(Role);

/** Roles a super admin may hand out. Assigning SUPERADMIN goes through the
 *  separate confirm-your-password flow, so it is not offered here. */
export const ASSIGNABLE_ROLES: readonly Role[] = [
  Role.ADMIN,
  Role.STAFF,
  Role.COLLAB,
  Role.CUSTOMER,
];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_VALUES as readonly string[]).includes(value);
}

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    [Role.SUPERADMIN]: 'Super Admin',
    [Role.ADMIN]: 'Admin',
    [Role.STAFF]: 'Support Staff',
    // "Partner" read as unclear/unfamiliar to non-technical users — renamed
    // to match the role's own enum name.
    [Role.COLLAB]: 'Collab',
    [Role.CUSTOMER]: 'Customer',
  };
  return labels[role];
}

/** One plain sentence per role, for the Admin screen's role picker. */
export function roleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    [Role.SUPERADMIN]:
      'Everything an admin can do, plus managing accounts and erasing shop data.',
    [Role.ADMIN]: 'Runs the shop — products, orders, customers, settings.',
    [Role.STAFF]: 'Customer support only — orders, fulfillment and the overview.',
    [Role.COLLAB]: 'Brand partner — sees only their own brand workspace.',
    [Role.CUSTOMER]: 'Shops on the storefront. Cannot open the dashboard at all.',
  };
  return descriptions[role];
}
