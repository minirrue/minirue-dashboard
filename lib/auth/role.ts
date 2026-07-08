/**
 * Canonical RBAC role vocabulary — mirrors
 * `apps/minirue-backend/src/common/enums/role.enum.ts`.
 *
 * Contract: `knowledge/specs/005-shared-enums-types/contracts/role-vocabulary.md`
 */

export const Role = {
  DEV: 'DEV',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  COLLAB: 'COLLAB',
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_VALUES: readonly Role[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_VALUES as readonly string[]).includes(value);
}

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    [Role.DEV]: 'Developer',
    // OWNER is the real top-level account role, but "Admin" is the label
    // non-technical users actually recognize — explicit rename, not a bug.
    [Role.OWNER]: 'Admin',
    [Role.ADMIN]: 'Administrator',
    [Role.STAFF]: 'Staff',
    // "Partner" read as unclear/unfamiliar to non-technical users — renamed
    // to match the role's own enum name.
    [Role.COLLAB]: 'Collab',
    [Role.CUSTOMER]: 'Customer',
  };
  return labels[role];
}
