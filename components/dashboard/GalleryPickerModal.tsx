'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  createFolder,
  listFolders,
  listItems,
  uploadItem,
} from '@/lib/gallery/api';
import type { GalleryFolder, GalleryItem } from '@/lib/gallery/types';
import type { ApiError } from '@/lib/api/client';

const TRACE = 'CMP-DASHBOARD-GALLERY-PICKER';

/**
 * Name of the auto-created folder used by the product form's "Upload from
 * this device" path (specs/006-gallery-module, US2, Acceptance Scenario 3) —
 * uploads via the product form must still create a real, gallery-visible
 * item rather than being gallery-invisible.
 */
const DEFAULT_UPLOAD_FOLDER_NAME = 'Product Photos';

/**
 * Finds (or creates) the caller's default "Product Photos" top-level folder,
 * then uploads `file` into it and returns the resulting GalleryItem. Used by
 * the "Upload from this device" path on the product new/edit screens so
 * device uploads still land in the user's own gallery (never
 * gallery-invisible), per spec Story 2.
 */
export async function uploadDeviceFileToGallery(file: File): Promise<GalleryItem> {
  const topLevel = await listFolders();
  let folder = topLevel.find((f) => f.name === DEFAULT_UPLOAD_FOLDER_NAME);
  if (!folder) {
    folder = await createFolder({ name: DEFAULT_UPLOAD_FOLDER_NAME });
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

  useEffect(() => {
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
