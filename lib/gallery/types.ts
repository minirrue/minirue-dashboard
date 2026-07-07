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
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  createdAt: string;
}
