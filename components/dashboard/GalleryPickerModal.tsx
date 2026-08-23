'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  createFolder,
  ensureProductFolder,
  listFolders,
  listItems,
  searchGallery,
  uploadItem,
} from '@/lib/gallery/api';
import type { GalleryFolder, GalleryItem, GallerySearchResult } from '@/lib/gallery/types';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import RetryingImage from '@/components/dashboard/RetryingImage';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';

const TRACE = 'CMP-DASHBOARD-GALLERY-PICKER';

/** Fallback folder name only used when no product name is available yet
 * (e.g. uploading a photo before the product's own name field is filled
 * in) — every real per-product upload uses the product's own name instead,
 * per explicit request: direct product-image uploads must land in a folder
 * named exactly after the product, not a generic shared bucket. */
const DEFAULT_UPLOAD_FOLDER_NAME = 'Product Photos';

/**
 * Uploads `file` into the right gallery folder and returns the resulting
 * GalleryItem. Used by the "Upload from this device" path on the product
 * new/edit screens (and anywhere else with no gallery UI of its own) so
 * device uploads still land in the user's own gallery, per spec Story 2.
 *
 * Two modes (task-w2.3-brief.md, Part B):
 * - `productId` given: the folder is resolved server-side —
 *   category → brand → product — via `ensureProductFolder()`, so "Perfumes"
 *   and "Billie Eilish" and "No.1" nest properly instead of sitting as
 *   top-level siblings.
 * - No `productId` (a category image, a hero image — no product context):
 *   falls back to the old top-level-folder-by-name behaviour, named after
 *   `productName` if given, else the generic `DEFAULT_UPLOAD_FOLDER_NAME`.
 *   Per the brief's ambiguity resolution #4, existing photos are never
 *   moved — this only changes where NEW uploads land.
 */
export async function uploadDeviceFileToGallery(
  file: File,
  productName?: string,
  productId?: string,
  /** '/catalog/admin' (default) or '/collab' — which side's own gallery
   *  folder tree this device upload resolves into. See
   *  `ensureProductFolder`'s doc comment. */
  mediaBasePath?: string,
): Promise<GalleryItem> {
  if (productId) {
    const { folderId } = await ensureProductFolder(productId, mediaBasePath);
    return uploadItem(folderId, file);
  }

  /*
   * Two levels, always. This branch used to create a TOP-LEVEL folder and drop
   * the file straight into it, which is exactly how "Product Photos" ended up
   * holding one loose image (owner, 2026-08-03: "prevent image per folder please
   * at all costs"). The server now refuses it outright, so nesting here is not a
   * nicety — without it this path 422s.
   *
   * The top level is the bucket and the child is the grouping, so uploads from
   * the same product land together instead of spawning a top-level folder each.
   */
  const parentName = DEFAULT_UPLOAD_FOLDER_NAME;
  const childName = productName?.trim() || 'Uploads';

  const topLevel = await listFolders();
  let parent = topLevel.find((f) => f.name === parentName);
  if (!parent) {
    parent = await createFolder({ name: parentName });
  }

  const children = await listFolders(parent.id);
  let folder = children.find((f) => f.name === childName);
  if (!folder) {
    folder = await createFolder({ name: childName, parentId: parent.id });
  }

  return uploadItem(folder.id, file);
}

interface GalleryPickerModalProps {
  onSelect: (item: GalleryItem) => void;
  onClose: () => void;
  /**
   * Crop aspect for the "Upload from this device" path, so a device upload is
   * framed the same way the field that opened this picker renders it. Undefined
   * means free crop.
   */
  aspectRatio?: number;
}

export default function GalleryPickerModal({
  onSelect,
  onClose,
  aspectRatio,
}: GalleryPickerModalProps) {
  /**
   * The folder trail from the root to where we are now. `[]` is the root.
   *
   * This replaced a single `selectedFolder`, which is what made SUBFOLDERS
   * UNREACHABLE (owner, 2026-08-03): `listFolders()` was only ever called with no
   * parent, so it returned top-level folders and nothing else, and opening a
   * folder loaded its ITEMS but never its child folders. A nested gallery was
   * therefore invisible from every picker in the dashboard.
   */
  const [path, setPath] = useState<GalleryFolder[]>([]);
  const current = path.length > 0 ? path[path.length - 1] : null;

  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const cropImage = useImageCrop();

  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<GallerySearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searching_ = query.trim().length > 0;

  /**
   * Loads ONE level: the child folders of `folder` (or the roots) and the items
   * directly inside it. Both, always — that is what makes the tree walkable.
   */
  const loadLevel = useCallback(async (folder: GalleryFolder | null) => {
    setLoadError(null);
    setItemsError(null);
    setLoading(true);
    setItemsLoading(true);
    try {
      const [childFolders, folderItems] = await Promise.all([
        listFolders(folder?.id),
        folder ? listItems(folder.id) : Promise.resolve<GalleryItem[]>([]),
      ]);
      setFolders(childFolders);
      setItems(folderItems);
    } catch (e) {
      const err = e as ApiError;
      setLoadError(err.message ?? 'Failed to load the gallery.');
    } finally {
      setLoading(false);
      setItemsLoading(false);
    }
  }, []);

  useMountedEffect(() => {
    loadLevel(null);
  }, [loadLevel]);

  /** Step INTO a folder. */
  function openFolder(folder: GalleryFolder) {
    setPath((p) => [...p, folder]);
    loadLevel(folder);
  }

  /** Jump to a point in the breadcrumb. `-1` is the root. */
  function goTo(index: number) {
    const next = index < 0 ? [] : path.slice(0, index + 1);
    setPath(next);
    loadLevel(next.length ? next[next.length - 1] : null);
  }

  /**
   * Jump straight to a folder found by search, wherever it lives.
   *
   * Its ancestors are not known here (search returns a breadcrumb of NAMES, not
   * rows), so the trail is seeded with just this folder. Navigation still works
   * downward, and the crumb offers "Gallery" to get back to the root.
   */
  function jumpToSearchFolder(folder: GalleryFolder) {
    setQuery('');
    setSearchResult(null);
    setPath([folder]);
    loadLevel(folder);
  }

  /**
   * Upload from the device straight into the folder being viewed, then hand the
   * new item back as if it had been picked — the owner asked for both routes side
   * by side in every picker, rather than gallery-only.
   *
   * Cropped first, like every other upload path in the dashboard (RULEBOOK: crop
   * everywhere). At the root there is no folder to put it in, so it falls back to
   * the same by-name folder logic device uploads have always used.
   */
  async function handleDeviceFile(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const cropped = await cropImage(file, {
        initialAspect: aspectRatio,
        title: `Crop ${file.name}`,
      });
      if (!cropped) return;
      // A top-level folder holds folders, not files, so an upload while one is
      // open goes through the nesting fallback rather than into it.
      const item =
        current && current.parentId !== null
          ? await uploadItem(current.id, cropped)
          : await uploadDeviceFileToGallery(cropped);
      onSelect(item);
    } catch (e) {
      const err = e as ApiError;
      setUploadError(err.message ?? 'Failed to upload that file.');
    } finally {
      setUploading(false);
    }
  }

  /** Empty query returns to normal folder browsing — search never replaces
   * it, it only overlays it while a query is present. */
  async function runSearch(raw: string) {
    setQuery(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      setSearchResult(null);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      setSearchResult(await searchGallery(trimmed));
    } catch (e) {
      const err = e as ApiError;
      setSearchError(err.message ?? 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="dash-dialog-overlay" data-trace-id={`${TRACE}::EL-REGION-overlay`}>
      <div
        className="dash-dialog"
        style={{ width: 'min(720px, 92vw)', maxHeight: '80vh', overflowY: 'auto' }}
        data-trace-id={`${TRACE}::EL-MODAL-gallery-picker`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="dash-dialog-message" style={{ margin: 0 }}>
            Choose from Gallery
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Both routes side by side in every picker (owner 2026-08-03).
                Uploads into whichever folder is open, so a device upload lands
                where the admin is already looking, not in a generic bucket. */}
            <button
              type="button"
              className="dash-btn-secondary"
              onClick={() => deviceInputRef.current?.click()}
              disabled={uploading}
              data-trace-id={`${TRACE}::EL-BTN-upload-from-device`}
            >
              {uploading
                ? 'Uploading...'
                : current && current.parentId !== null
                  ? 'Upload here'
                  : 'Upload from device'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={onClose}
              data-trace-id={`${TRACE}::EL-BTN-close-gallery-picker`}
            >
              Close
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <input
            type="search"
            className="dash-input"
            placeholder="Search photos, videos and folders…"
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            data-trace-id={`${TRACE}::EL-INPUT-picker-search`}
          />
        </div>

        <input
          ref={deviceInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp,.heic,.heif,.hif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleDeviceFile(file);
            e.target.value = '';
          }}
        />
        {uploadError && <p className="dash-inline-error">{uploadError}</p>}

        {searching_ ? (
          <div style={{ marginTop: 16 }} data-trace-id={`${TRACE}::EL-REGION-picker-search-results`}>
            {searching ? (
              <p className="dash-help-text">Searching…</p>
            ) : searchError ? (
              <p className="dash-inline-error">{searchError}</p>
            ) : !searchResult || (searchResult.items.length === 0 && searchResult.folders.length === 0) ? (
              <p className="dash-help-text">No matches for &ldquo;{query.trim()}&rdquo;.</p>
            ) : (
              <>
                {searchResult.folders.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p className="dash-section-subtitle" style={{ marginTop: 0 }}>Folders</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {searchResult.folders.map((folder) => (
                        <button
                          key={folder.id}
                          type="button"
                          className="dash-btn-ghost"
                          style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                          onClick={() => {
                            jumpToSearchFolder(folder);
                          }}
                          data-trace-id={`${TRACE}::EL-BTN-search-result-folder@${folder.id}`}
                        >
                          📁 {folder.breadcrumb.join(' / ') || folder.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {searchResult.items.length > 0 && (
                  <div>
                    <p className="dash-section-subtitle" style={{ marginTop: 0 }}>Photos &amp; videos</p>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: 12,
                      }}
                      data-trace-id={`${TRACE}::EL-GRID-search-result-items`}
                    >
                      {searchResult.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelect(item)}
                          title={item.breadcrumb.join(' / ')}
                          style={{
                            padding: 0,
                            border: '1px solid var(--mr-dash-hair)',
                            borderRadius: 'var(--mr-radius-sm)',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: 'none',
                          }}
                          data-trace-id={`${TRACE}::EL-BTN-select-search-result-item@${item.id}`}
                        >
                          {item.kind === 'video' ? (
                            <video
                              src={item.url}
                              poster={item.posterUrl ?? undefined}
                              muted
                              preload={item.posterUrl ? 'none' : 'metadata'}
                              style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover' }}
                            />
                          ) : (
                            <RetryingImage
                              src={item.url}
                              alt=""
                              style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover' }}
                            />
                          )}
                          <span
                            className="dash-help-text"
                            style={{
                              display: 'block',
                              padding: '2px 4px',
                              fontSize: 10,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.breadcrumb.join(' / ')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            {/* Breadcrumb - the way BACK out of a subfolder. Without one, stepping
                into a nested folder was a dead end. */}
            <nav
              aria-label="Gallery folders"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 4,
                marginBottom: 12,
              }}
              data-trace-id={`${TRACE}::EL-REGION-picker-breadcrumb`}
            >
              <button
                type="button"
                className="dash-btn-ghost"
                onClick={() => goTo(-1)}
                disabled={path.length === 0}
                data-trace-id={`${TRACE}::EL-BTN-picker-crumb-root`}
              >
                Gallery
              </button>
              {path.map((folder, i) => (
                <React.Fragment key={folder.id}>
                  <span aria-hidden="true" className="dash-help-text">/</span>
                  <button
                    type="button"
                    className="dash-btn-ghost"
                    onClick={() => goTo(i)}
                    disabled={i === path.length - 1}
                    data-trace-id={`${TRACE}::EL-BTN-picker-crumb@${folder.id}`}
                  >
                    {folder.name}
                  </button>
                </React.Fragment>
              ))}
            </nav>

            {loadError && <p className="dash-inline-error">{loadError}</p>}

            {/* Folders and items for THIS level, folders first, so a folder that
                holds both is fully browsable. */}
            <p className="dash-section-subtitle" style={{ marginTop: 0 }}>Folders</p>
            {loading ? (
              <p className="dash-help-text">Loading...</p>
            ) : folders.length === 0 ? (
              <p className="dash-help-text">
                {current ? 'No folders inside this one.' : 'No folders yet.'}
              </p>
            ) : (
              <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}
                data-trace-id={`${TRACE}::EL-LIST-picker-folders`}
              >
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className="dash-btn-ghost"
                    onClick={() => openFolder(folder)}
                    style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                    data-trace-id={`${TRACE}::EL-BTN-picker-folder@${folder.id}`}
                  >
                    {folder.name} ({folder.itemCount})
                  </button>
                ))}
              </div>
            )}

            <p className="dash-section-subtitle">Items</p>
            {!current ? (
              <p className="dash-help-text">Open a folder to see its photos and videos.</p>
            ) : itemsLoading ? (
              <p className="dash-help-text">Loading items...</p>
            ) : itemsError ? (
              <p className="dash-inline-error">{itemsError}</p>
            ) : items.length === 0 ? (
              <p className="dash-help-text">Nothing directly in this folder.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: 12,
                }}
                data-trace-id={`${TRACE}::EL-GRID-picker-items`}
              >
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
                    style={{
                      padding: 0,
                      border: '1px solid var(--mr-dash-hair)',
                      borderRadius: 'var(--mr-radius-sm)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: 'none',
                    }}
                    data-trace-id={`${TRACE}::EL-BTN-select-picker-item@${item.id}`}
                  >
                    {item.kind === 'video' ? (
                      <video
                        src={item.url}
                        poster={item.posterUrl ?? undefined}
                        muted
                        preload={item.posterUrl ? 'none' : 'metadata'}
                        style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover' }}
                      />
                    ) : (
                      <RetryingImage
                        src={item.url}
                        alt=""
                        style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover' }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
