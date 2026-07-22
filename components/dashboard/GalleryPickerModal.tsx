'use client';

import React, {useCallback, useState } from 'react';
import {
  createFolder,
  listFolders,
  listItems,
  uploadItem,
} from '@/lib/gallery/api';
import type { GalleryFolder, GalleryItem } from '@/lib/gallery/types';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

const TRACE = 'CMP-DASHBOARD-GALLERY-PICKER';

/** Fallback folder name only used when no product name is available yet
 * (e.g. uploading a photo before the product's own name field is filled
 * in) — every real per-product upload uses the product's own name instead,
 * per explicit request: direct product-image uploads must land in a folder
 * named exactly after the product, not a generic shared bucket. */
const DEFAULT_UPLOAD_FOLDER_NAME = 'Product Photos';

/**
 * Finds (or creates) a top-level gallery folder named exactly after
 * `productName` (falling back to the generic default only when no product
 * name is available), then uploads `file` into it and returns the resulting
 * GalleryItem. Used by the "Upload from this device" path on the product
 * new/edit screens so device uploads still land in the user's own gallery
 * (never gallery-invisible), per spec Story 2 — now organized per-product
 * rather than all dumped into one shared folder.
 */
export async function uploadDeviceFileToGallery(
  file: File,
  productName?: string,
): Promise<GalleryItem> {
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

        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, marginTop: 16 }}>
          <div>
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

          <div>
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
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
      </div>
    </div>
  );
}
