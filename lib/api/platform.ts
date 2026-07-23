import { apiFetch } from './client';
import type { Role } from '@/lib/auth/role';

/**
 * The super admin data reset.
 * specs/2026-07-22-platform-reset
 *
 * Every one of these calls is refused by the server unless the caller holds
 * SUPERADMIN. Hiding the panel in the dashboard is presentation only — it is
 * never the permission.
 */

export interface ResetGroupPreview {
  key: string;
  /** Plain-English name — safe to show as-is. */
  label: string;
  description: string;
  /** Rows that would go. */
  rowCount: number;
  /** Stored files that would go. Zero for groups that hold no files. */
  fileCount: number;
  /** Other group keys that must be ticked alongside this one. */
  requires: string[];
}

export interface ResetPreview {
  groups: ResetGroupPreview[];
  /** What is never touched, whatever is ticked. */
  neverDeleted: string[];
  /** The exact text the admin must type to go ahead. */
  confirmationPhrase: string;
}

export interface ResetResult {
  /** Rows removed, per table. */
  deleted: Record<string, number>;
  filesDeleted: number;
}

/** Shows what would be erased. Deletes nothing. */
export async function getResetPreview(): Promise<ResetPreview> {
  const res = await apiFetch<{ data: ResetPreview }>('/platform/reset/preview', {
    auth: true,
  });
  return res.data;
}

/** Erases the ticked groups. Not reversible. */
export async function runReset(
  groups: string[],
  confirmation: string,
): Promise<ResetResult> {
  const res = await apiFetch<{ data: ResetResult }>('/platform/reset', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ groups, confirmation }),
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Super admin accounts
// ---------------------------------------------------------------------------

export interface SuperAdminSummary {
  id: string;
  name: string;
  createdAt: string;
}

export async function listSuperAdmins(): Promise<SuperAdminSummary[]> {
  const res = await apiFetch<{ data: SuperAdminSummary[] }>(
    '/platform/super-admins',
    { auth: true },
  );
  return Array.isArray(res?.data) ? res.data : [];
}

/**
 * Creates the account, or promotes an existing one with that email.
 * `confirmPassword` is the CALLER's own password — the server refuses without
 * it, so an unattended session cannot mint an account that erases the shop.
 */
export async function createSuperAdmin(data: {
  email: string;
  password: string;
  name?: string;
  confirmPassword: string;
}): Promise<SuperAdminSummary> {
  const res = await apiFetch<{ data: SuperAdminSummary }>(
    '/platform/super-admins',
    { method: 'POST', auth: true, body: JSON.stringify(data) },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Account administration — every account, at any role. SUPERADMIN only.
// specs/2026-07-23-account-administration
// ---------------------------------------------------------------------------

export interface AccountSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  /** True for the signed-in account — its own row cannot be deleted. */
  isSelf: boolean;
}

export interface AccountsPage {
  data: AccountSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface ListAccountsParams {
  search?: string;
  email?: string;
  role?: Role;
  status?: 'ACTIVE' | 'SUSPENDED';
  page?: number;
  limit?: number;
}

export async function listAccounts(
  params: ListAccountsParams = {},
): Promise<AccountsPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  const res = await apiFetch<AccountsPage>(
    `/platform/accounts${qs ? `?${qs}` : ''}`,
    { auth: true },
  );
  return {
    data: Array.isArray(res?.data) ? res.data : [],
    total: res?.total ?? 0,
    page: res?.page ?? 1,
    limit: res?.limit ?? 25,
  };
}

export async function createAccount(data: {
  email: string;
  password: string;
  name: string;
  role: Role;
  /** The caller's own password. Required only when creating a super admin. */
  confirmPassword?: string;
}): Promise<AccountSummary> {
  const res = await apiFetch<{ data: AccountSummary }>('/platform/accounts', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateAccount(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: Role;
    status?: 'ACTIVE' | 'SUSPENDED';
    password?: string;
    /** The caller's own password — needed to grant SUPERADMIN or set a password. */
    confirmPassword?: string;
  },
): Promise<AccountSummary> {
  const res = await apiFetch<{ data: AccountSummary }>(
    `/platform/accounts/${id}`,
    { method: 'PATCH', auth: true, body: JSON.stringify(data) },
  );
  return res.data;
}

/** Removes the account for good. The caller retypes their own password. */
export async function deleteAccount(
  id: string,
  confirmPassword: string,
): Promise<void> {
  await apiFetch<{ data: { deleted: true } }>(`/platform/accounts/${id}`, {
    method: 'DELETE',
    auth: true,
    body: JSON.stringify({ confirmPassword }),
  });
}

export interface SignInAsResult {
  accessToken: string;
  expiresIn: number;
  actingAs: { id: string; name: string; email: string; role: Role };
}

/**
 * A short-lived token for another account. There is no refresh token by
 * design, so the borrowed session expires on its own.
 */
export async function signInAsAccount(
  id: string,
  confirmPassword: string,
): Promise<SignInAsResult> {
  const res = await apiFetch<{ data: SignInAsResult }>(
    `/platform/accounts/${id}/sign-in-as`,
    { method: 'POST', auth: true, body: JSON.stringify({ confirmPassword }) },
  );
  return res.data;
}
