import { apiFetch, apiUpload } from '@/lib/api/client';
import type { GalleryFolder, GalleryItem, GallerySearchResult } from './types';

const BASE = '/gallery';

export async function listFolders(parentId?: string): Promise<GalleryFolder[]> {
  const qs = parentId ? `?parentId=${encodeURIComponent(parentId)}` : '';
  const res = await apiFetch<{ data: GalleryFolder[] }>(`${BASE}/folders${qs}`, {
    auth: true,
  });
  return res.data;
}

export async function createFolder(data: {
  name: string;
  parentId?: string;
}): Promise<GalleryFolder> {
  return apiFetch<GalleryFolder>(`${BASE}/folders`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      name: data.name,
      parentId: data.parentId || undefined,
    }),
  });
}

export async function renameFolder(id: string, name: string): Promise<GalleryFolder> {
  return apiFetch<GalleryFolder>(`${BASE}/folders/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ name }),
  });
}

export async function deleteFolder(id: string): Promise<void> {
  await apiFetch<void>(`${BASE}/folders/${id}`, { method: 'DELETE', auth: true });
}

export async function listItems(
  folderId: string,
  opts?: { limit?: number; offset?: number },
): Promise<GalleryItem[]> {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch<{ data: GalleryItem[] }>(
    `${BASE}/folders/${folderId}/items${qs}`,
    { auth: true },
  );
  return res.data;
}

/** Resolve a single gallery item (with its loadable `url`) by id — used to
 *  preview an image that was set on a slide in an earlier session. */
export async function getItem(id: string): Promise<GalleryItem> {
  const res = await apiFetch<{ data: GalleryItem }>(`${BASE}/items/${id}`, {
    auth: true,
  });
  return res.data;
}

export async function uploadItem(
  folderId: string,
  file: File,
  altText?: string,
): Promise<GalleryItem> {
  const formData = new FormData();
  formData.append('folderId', folderId);
  formData.append('file', file);
  if (altText) formData.append('altText', altText);
  return apiUpload<GalleryItem>(`${BASE}/items`, formData);
}

export async function updateItemAltText(id: string, altText: string): Promise<GalleryItem> {
  return apiFetch<GalleryItem>(`${BASE}/items/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ altText }),
  });
}

export async function deleteItem(id: string): Promise<void> {
  await apiFetch<void>(`${BASE}/items/${id}`, { method: 'DELETE', auth: true });
}

/**
 * "Exchange" — replaces this item's picture/video in place
 * (task-w2.3-brief.md, Part A). The item keeps its id/folderId/altText;
 * only the underlying bytes change, so everything already pointing at this
 * gallery item (a product's media, a category's/brand's `imageMediaId`)
 * keeps working with no re-linking. `PATCH .../file`, not `POST` — the
 * method `apiUpload` now accepts is exactly what this needed.
 */
export async function exchangeItem(id: string, file: File): Promise<GalleryItem> {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<GalleryItem>(`${BASE}/items/${id}/file`, formData, 'PATCH');
}

/**
 * `GET /gallery/search?q=` — matches folder names, item alt text, and the
 * linked product's name, each result carrying its full breadcrumb
 * (task-w2.3-brief.md, Part B). An empty/whitespace query is never sent —
 * callers should treat that as "go back to normal folder browsing".
 */
export async function searchGallery(
  q: string,
  opts?: { page?: number; limit?: number },
): Promise<GallerySearchResult> {
  const params = new URLSearchParams({ q });
  if (opts?.page !== undefined) params.set('page', String(opts.page));
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  return apiFetch<GallerySearchResult>(`${BASE}/search?${params.toString()}`, {
    auth: true,
  });
}

/**
 * Resolves (creating whatever is missing) the auto-organised gallery folder
 * a device upload for `productId` belongs in — category → brand → product
 * (task-w2.3-brief.md, Part B). Lives here rather than `lib/catalog/api.ts`
 * because it's conceptually a gallery-folder lookup even though the backend
 * route sits under `/catalog/admin` (GalleryModule cannot depend on
 * CatalogModule — see `catalog.service.ts`'s `resolveMediaFolder` doc
 * comment for why). Call this BEFORE `uploadItem()` so the upload lands
 * straight into the right folder instead of a flat top-level one.
 */
/**
 * `basePath` defaults to the admin catalogue but accepts `/collab` too — a
 * collaborator's own device upload resolves against THEIR gallery folder
 * tree (CollabProductsService.resolveMediaFolder), never an admin user's;
 * see that method's doc comment for why passing the wrong one would be a
 * cross-space collision.
 */
export async function ensureProductFolder(
  productId: string,
  basePath: string = '/catalog/admin',
): Promise<{ folderId: string }> {
  return apiFetch<{ folderId: string }>(
    `${basePath}/products/${productId}/media/folder`,
    { method: 'POST', auth: true },
  );
}

