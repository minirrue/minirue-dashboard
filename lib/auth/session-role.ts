import { clearTokens } from '@/lib/auth/tokens';
import { isRole, type Role } from '@/lib/auth/role';
import type { UserProfile } from '@/lib/auth/types';
import { isStaffRole } from '@/lib/auth/roles';

export class InvalidSessionRoleError extends Error {
  constructor() {
    super('Session role is not in the canonical vocabulary');
    this.name = 'InvalidSessionRoleError';
  }
}

export class InsufficientStaffRoleError extends Error {
  constructor() {
    super('This account does not have admin access');
    this.name = 'InsufficientStaffRoleError';
  }
}

/** Reject non-canonical roles from auth API responses (FR-008 parity). */
export function assertCanonicalRole(role: unknown): asserts role is Role {
  if (!isRole(role)) {
    clearTokens();
    throw new InvalidSessionRoleError();
  }
}

export function parseAuthUser(user: { userId: string; role: unknown; email: string; name?: string }): UserProfile {
  assertCanonicalRole(user.role);
  if (!isStaffRole(user.role)) {
    clearTokens();
    throw new InsufficientStaffRoleError();
  }
  return {
    userId: user.userId,
    role: user.role,
    email: user.email,
    name: user.name,
  };
}
