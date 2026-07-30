'use client';

import React, { useCallback, useState } from 'react';
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
): Promise<GalleryItem> {
  if (productId) {
    const { folderId } = await ensureProductFolder(productId);
    return uploadItem(folderId, file);
  }

  const folderName = productName?.trim() || DEFAULT_UPLOAD_FOLDER_NAME;
  const topLevel = await listFolders();
  let folder = topLevel.find((f) => f.name === folderName);
  if (!folder) {
    folder = await createFolder({ name: folderName });
  }
  return uploadItem(folder.id, file);
}

interface GalleryPickerModalProps {
  onSelect: (item: GalleryItem) => void;
  onClose: () => void;
}

export default function GalleryPickerModal({ onSelect, onClose }: GalleryPickerModalProps) {
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedFolder, setSelectedFolder] = useState<GalleryFolder | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<GallerySearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searching_ = query.trim().length > 0;

  const loadFolders = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      setFolders(await listFolders());
    } catch (e) {
      const err = e as ApiError;
      setLoadError(err.message ?? 'Failed to load gallery folders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => {
    loadFolders();
  }, [loadFolders]);

  async function handleSelectFolder(folder: GalleryFolder) {
    setSelectedFolder(folder);
    setItemsLoading(true);
    setItemsError(null);
    try {
      setItems(await listItems(folder.id));
    } catch (e) {
      const err = e as ApiError;
      setItemsError(err.message ?? 'Failed to load folder contents.');
    } finally {
      setItemsLoading(false);
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
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={onClose}
            data-trace-id={`${TRACE}::EL-BTN-close-gallery-picker`}
          >
            Close
          </button>
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
                            setQuery('');
                            setSearchResult(null);
                            handleSelectFolder(folder);
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
                              muted
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
            <div style={{ flex: '0 0 160px', maxWidth: '100%', minWidth: 0 }}>
              <p className="dash-section-subtitle" style={{ marginTop: 0 }}>Folders</p>
              {loading ? (
                <p className="dash-help-text">Loading…</p>
              ) : loadError ? (
                <p className="dash-inline-error">{loadError}</p>
              ) : folders.length === 0 ? (
                <p className="dash-help-text">No folders yet.</p>
              ) : (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                  data-trace-id={`${TRACE}::EL-LIST-picker-folders`}
                >
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      className="dash-btn-ghost"
                      data-active={selectedFolder?.id === folder.id ? 'true' : undefined}
                      onClick={() => handleSelectFolder(folder)}
                      style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                      data-trace-id={`${TRACE}::EL-BTN-picker-folder@${folder.id}`}
                    >
                      📁 {folder.name} ({folder.itemCount})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: '1 1 200px', maxWidth: '100%', minWidth: 0 }}>
              <p className="dash-section-subtitle" style={{ marginTop: 0 }}>Items</p>
              {!selectedFolder ? (
                <p className="dash-help-text">Select a folder to view its photos and videos.</p>
              ) : itemsLoading ? (
                <p className="dash-help-text">Loading items…</p>
              ) : itemsError ? (
                <p className="dash-inline-error">{itemsError}</p>
              ) : items.length === 0 ? (
                <p className="dash-help-text">No items in this folder yet.</p>
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
                          muted
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
          </div>
        )}
      </div>
    </div>
  );
}
