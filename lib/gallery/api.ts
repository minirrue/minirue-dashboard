import { apiFetch, apiUpload } from '@/lib/api/client';
import type { GalleryFolder, GalleryItem } from './types';

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

export async function listItems(folderId: string): Promise<GalleryItem[]> {
  const res = await apiFetch<{ data: GalleryItem[] }>(
    `${BASE}/folders/${folderId}/items`,
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
