import { apiFetch } from './client';

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
