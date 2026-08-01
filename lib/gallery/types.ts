// Shared Gallery types — mirrors the backend response shapes declared in
// specs/006-gallery-module/contracts/gallery-routes.md. The API client
// (lib/gallery/api.ts, tasks.md T018) is a follow-up task; this file only
// defines the shapes it will consume/return.

export type GalleryItemKind = 'image' | 'video';

export interface GalleryFolder {
  id: string;
  name: string;
  parentId: string | null;
  itemCount: number; // computed, not stored
  createdAt: string;
}

export interface GalleryItem {
  id: string;
  folderId: string;
  kind: GalleryItemKind;
  url: string; // resolved via StorageService.resolveUrl() / imgproxy, never a raw storage key
  /** A video's poster frame, resolved the same way `url` is. Null for an
   *  image, and for a video uploaded before posters existed (migration 0190) —
   *  render `<video poster={posterUrl ?? undefined}>` and the browser falls
   *  back to its own first frame, exactly as before. */
  posterUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
  createdAt: string;
}

/**
 * `GET /gallery/search` result shapes (task-w2.3-brief.md, Part B). Each
 * result carries its full breadcrumb — root-first folder names — so the
 * admin can see where a match lives without a second lookup.
 */
export interface GallerySearchItem extends GalleryItem {
  breadcrumb: string[];
}

export interface GallerySearchFolder extends GalleryFolder {
  breadcrumb: string[];
}

export interface GallerySearchResult {
  items: GallerySearchItem[];
  folders: GallerySearchFolder[];
  meta: {
    itemsTotal: number;
    foldersTotal: number;
    page: number;
    limit: number;
  };
}
