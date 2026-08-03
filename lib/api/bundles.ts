import { apiFetch } from './client';

/**
 * Sets of products sold together at one price.
 *
 * A set may hold one product (a single item at a special price) up to six. Only
 * MiniRue's own products are allowed — the backend re-checks this on save, so
 * the picker filtering them out is a convenience rather than the guard.
 */

export interface BundleMember {
  productId: string;
  variantId: string | null;
  productName: string;
  productSlug: string;
  brandName: string;
  quantity: number;
  unitMinor: number;
  /** This member's share of the set price, allocated so the parts sum exactly. */
  allocatedMinor: number;
}

export interface Bundle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Resolved for display. Comes from `imageMediaId` when set, else the legacy
   *  pasted URL — see migration 0220. */
  imageUrl: string | null;
  /** The gallery item this bundle's cover points at, or null. What you SEND. */
  imageMediaId?: string | null;
  priceMinor: number;
  currency: string;
  /** What the members cost separately — recomputed live, never stored. */
  listTotalMinor: number;
  savingMinor: number;
  isActive: boolean;
  ownerCustomerId: string | null;
  expiresAt: string | null;
  usedCount: number;
  /** False when any member is out of stock; the shop hides it. */
  inStock: boolean;
  members: BundleMember[];
}

export interface BundleMemberInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface BundleInput {
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  /** Gallery pointer for this bundle's own cover. `null` clears it. Distinct
   *  from the shop page's "Bundles" tile cover, which is a space-level setting
   *  managed under Categories. */
  imageMediaId?: string | null;
  priceMinor: number;
  isActive: boolean;
  ownerCustomerId?: string | null;
  expiresAt?: string | null;
  members: BundleMemberInput[];
}

export async function listBundles(): Promise<Bundle[]> {
  const res = await apiFetch<{ data: Bundle[] }>('/admin/bundles', { auth: true });
  return res.data;
}

export async function getBundle(id: string): Promise<Bundle> {
  return apiFetch<Bundle>(`/admin/bundles/${id}`, { auth: true });
}

export async function createBundle(input: BundleInput): Promise<Bundle> {
  return apiFetch<Bundle>('/admin/bundles', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export async function updateBundle(
  id: string,
  input: Partial<BundleInput>,
): Promise<Bundle> {
  return apiFetch<Bundle>(`/admin/bundles/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(input),
  });
}

export async function deleteBundle(id: string): Promise<void> {
  await apiFetch<void>(`/admin/bundles/${id}`, { method: 'DELETE', auth: true });
}

/** `Evening Set` → `evening-set`. Matches the slug rule the backend enforces. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
