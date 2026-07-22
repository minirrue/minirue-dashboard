'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createFolder,
  deleteFolder,
  deleteItem,
  listFolders,
  listItems,
  renameFolder,
  updateItemAltText,
  uploadItem,
} from '@/lib/gallery/api';
import type { GalleryFolder, GalleryItem } from '@/lib/gallery/types';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

const TRACE = 'PG-DASHBOARD-GAL-001';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ── Folder list (top-level or one level of children) ── */
interface FolderListProps {
  folders: GalleryFolder[];
  selectedId: string | null;
  onSelect: (folder: GalleryFolder) => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function FolderRow({
  folder,
  selected,
  onSelect,
  onRename,
  onDelete,
}: {
  folder: GalleryFolder;
  selected: boolean;
  onSelect: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onRename(name.trim());
      setEditing(false);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Rename failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setBusy(true);
    try {
      await onDelete();
    } catch (e) {
      const err = e as ApiError;
      setError(
        err.status === 409
          ? 'Folder is not empty — remove its items first.'
          : err.message ?? 'Delete failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        className="dash-inline-form"
        onSubmit={handleRename}
        data-trace-id={`${TRACE}::EL-FORM-rename-folder@${folder.id}`}
      >
        <input
          className="dash-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          autoFocus
          data-trace-id={`${TRACE}::EL-INPUT-rename-folder-name@${folder.id}`}
        />
        <button type="submit" className="dash-btn-primary" disabled={busy}>
          Save
        </button>
        <button
          type="button"
          className="dash-btn-ghost"
          onClick={() => {
            setEditing(false);
            setName(folder.name);
            setError(null);
          }}
          disabled={busy}
        >
          Cancel
        </button>
        {error && <p className="dash-field-error">{error}</p>}
      </form>
    );
  }

  return (
    <div
      className="dash-gallery-folder-row"
      data-active={selected ? 'true' : undefined}
      data-trace-id={`${TRACE}::EL-ROW-gallery-folder@${folder.id}`}
    >
      <button
        type="button"
        className="dash-gallery-folder-btn"
        onClick={onSelect}
        data-trace-id={`${TRACE}::EL-BTN-select-gallery-folder@${folder.id}`}
      >
        <span aria-hidden="true">📁</span>
        <span>{folder.name}</span>
        <span className="dash-gallery-folder-count">{folder.itemCount}</span>
      </button>
      <div className="dash-gallery-folder-actions">
        <button
          type="button"
          className="dash-btn-ghost"
          onClick={() => setEditing(true)}
          disabled={busy}
          data-trace-id={`${TRACE}::EL-BTN-rename-gallery-folder@${folder.id}`}
        >
          Rename
        </button>
        <button
          type="button"
          className="dash-btn-ghost"
          onClick={handleDelete}
          disabled={busy}
          data-trace-id={`${TRACE}::EL-BTN-delete-gallery-folder@${folder.id}`}
        >
          Delete
        </button>
      </div>
      {error && <p className="dash-field-error">{error}</p>}
    </div>
  );
}

function FolderList({ folders, selectedId, onSelect, onRename, onDelete }: FolderListProps) {
  if (folders.length === 0) {
    return <p className="dash-help-text">No folders yet.</p>;
  }
  return (
    <div className="dash-gallery-folder-list" data-trace-id={`${TRACE}::EL-LIST-gallery-folders`}>
      {folders.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          selected={selectedId === folder.id}
          onSelect={() => onSelect(folder)}
          onRename={(name) => onRename(folder.id, name)}
          onDelete={() => onDelete(folder.id)}
        />
      ))}
    </div>
  );
}

/* ── Upload dropzone (drag-drop + click-to-browse) ── */
interface UploadDropzoneProps {
  folderId: string;
  onUploaded: (item: GalleryItem) => void;
}

function UploadDropzone({ folderId, onUploaded }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const item = await uploadItem(folderId, file);
          onUploaded(item);
        }
      } catch (e) {
        const err = e as ApiError;
        setError(err.message ?? 'Upload failed.');
      } finally {
        setUploading(false);
      }
    },
    [folderId, onUploaded],
  );

  return (
    <div
      className="dash-gallery-dropzone"
      data-active={dragActive ? 'true' : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files.length > 0) upload(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      data-trace-id={`${TRACE}::EL-REGION-gallery-upload-dropzone`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) upload(e.target.files);
          e.target.value = '';
        }}
        data-trace-id={`${TRACE}::EL-INPUT-gallery-upload-file`}
      />
      <p className="dash-gallery-dropzone-text">
        {uploading ? 'Uploading…' : 'Drag photos or videos here, or click to browse'}
      </p>
      <p className="dash-help-text">JPEG, PNG, HEIC, HEIF, WEBP, MP4, MOV</p>
      {error && <p className="dash-inline-error">{error}</p>}
    </div>
  );
}

/* ── Full-size preview modal — tap a thumbnail to see the real upload,
   uncropped (object-fit: contain, not cover — the point is verifying what
   was actually uploaded, not a cropped decorative preview). ── */
function ItemPreviewModal({
  item,
  onClose,
}: {
  item: GalleryItem;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="dash-gallery-preview-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      data-trace-id={`${TRACE}::EL-MODAL-gallery-item-preview@${item.id}`}
    >
      <button
        type="button"
        className="dash-gallery-preview-close"
        onClick={onClose}
        aria-label="Close preview"
        data-trace-id={`${TRACE}::EL-BTN-close-gallery-preview@${item.id}`}
      >
        ✕
      </button>
      <div className="dash-gallery-preview-frame" onClick={(e) => e.stopPropagation()}>
        {item.kind === 'video' ? (
          <video
            src={item.url}
            className="dash-gallery-preview-media"
            controls
            autoPlay
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" className="dash-gallery-preview-media" />
        )}
      </div>
    </div>
  );
}

/* ── SEO alt text — inline-editable, doubles as the image's actual alt
   attribute both here and (once linked) on the product's mediaAssets row. ── */
function AltTextField({
  item,
  onSave,
}: {
  item: GalleryItem;
  onSave: (altText: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.altText ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(value.trim());
      setEditing(false);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Failed to save name.');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        className="dash-inline-form"
        onSubmit={handleSubmit}
        data-trace-id={`${TRACE}::EL-FORM-gallery-item-alt-text@${item.id}`}
      >
        <input
          className="dash-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Creed Aventus 100ml front view"
          disabled={busy}
          autoFocus
          data-trace-id={`${TRACE}::EL-INPUT-gallery-item-alt-text@${item.id}`}
        />
        <button type="submit" className="dash-btn-primary" disabled={busy}>
          Save
        </button>
        <button
          type="button"
          className="dash-btn-ghost"
          onClick={() => {
            setEditing(false);
            setValue(item.altText ?? '');
            setError(null);
          }}
          disabled={busy}
        >
          Cancel
        </button>
        {error && <p className="dash-field-error">{error}</p>}
      </form>
    );
  }

  return (
    <button
      type="button"
      className="dash-gallery-item-alt-btn"
      onClick={() => setEditing(true)}
      data-trace-id={`${TRACE}::EL-BTN-edit-gallery-item-alt-text@${item.id}`}
    >
      {item.altText || 'Add name / alt text'}
    </button>
  );
}

/* ── Item grid ── */
function ItemGrid({
  items,
  onDelete,
  onPreview,
  onRenameAlt,
}: {
  items: GalleryItem[];
  onDelete: (id: string) => Promise<void>;
  onPreview: (item: GalleryItem) => void;
  onRenameAlt: (id: string, altText: string) => Promise<void>;
}) {
  if (items.length === 0) {
    return <p className="dash-help-text">No items in this folder yet.</p>;
  }
  return (
    <div className="dash-gallery-item-grid" data-trace-id={`${TRACE}::EL-GRID-gallery-items`}>
      {items.map((item) => (
        <div
          key={item.id}
          className="dash-gallery-item-card"
          data-trace-id={`${TRACE}::EL-CARD-gallery-item@${item.id}`}
        >
          <button
            type="button"
            className="dash-gallery-item-media-btn"
            onClick={() => onPreview(item)}
            aria-label="View full size"
            data-trace-id={`${TRACE}::EL-BTN-preview-gallery-item@${item.id}`}
          >
            {item.kind === 'video' ? (
              <video src={item.url} className="dash-gallery-item-media" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt={item.altText ?? ''} className="dash-gallery-item-media" />
            )}
          </button>
          <AltTextField item={item} onSave={(altText) => onRenameAlt(item.id, altText)} />
          <div className="dash-gallery-item-meta">
            <span>{formatDate(item.createdAt)}</span>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => onDelete(item.id)}
              data-trace-id={`${TRACE}::EL-BTN-delete-gallery-item@${item.id}`}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main page ── */
export default function GalleryClient() {
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedFolder, setSelectedFolder] = useState<GalleryFolder | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);

  const loadFolders = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await listFolders();
      setFolders(res);
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

  const loadFolderContents = useCallback(async (folder: GalleryFolder) => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const folderItems = await listItems(folder.id);
      setItems(folderItems);
    } catch (e) {
      const err = e as ApiError;
      setItemsError(err.message ?? 'Failed to load folder contents.');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  function handleSelectFolder(folder: GalleryFolder) {
    setSelectedFolder(folder);
    loadFolderContents(folder);
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) {
      setAddError('Name is required.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await createFolder({ name: newFolderName.trim() });
      setNewFolderName('');
      setShowAddForm(false);
      await loadFolders();
    } catch (e) {
      const err = e as ApiError;
      setAddError(err.message ?? 'Failed to create folder.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRenameTopLevel(id: string, name: string) {
    await renameFolder(id, name);
    await loadFolders();
    if (selectedFolder?.id === id) setSelectedFolder((prev) => (prev ? { ...prev, name } : prev));
  }

  async function handleDeleteTopLevel(id: string) {
    await deleteFolder(id);
    await loadFolders();
    if (selectedFolder?.id === id) {
      setSelectedFolder(null);
      setItems([]);
    }
  }

  async function handleRenameItemAlt(id: string, altText: string) {
    const updated = await updateItemAltText(id, altText);
    setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
  }

  async function handleDeleteItem(id: string) {
    await deleteItem(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedFolder) {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === selectedFolder.id ? { ...f, itemCount: Math.max(0, f.itemCount - 1) } : f,
        ),
      );
    }
  }

  function handleItemUploaded(item: GalleryItem) {
    setItems((prev) => [item, ...prev]);
    setFolders((prev) =>
      prev.map((f) => (f.id === item.folderId ? { ...f, itemCount: f.itemCount + 1 } : f)),
    );
  }

  return (
    <>
      <div className="dash-page-header" data-trace-id={`${TRACE}::EL-REGION-gallery-page-header`}>
        <h1 className="dash-page-title">Gallery</h1>
        {!showAddForm && (
          <button
            type="button"
            className="dash-btn-primary"
            onClick={() => setShowAddForm(true)}
            data-trace-id={`${TRACE}::EL-BTN-show-add-folder-form`}
          >
            New Folder
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          className="dash-form-card"
          onSubmit={handleCreateFolder}
          noValidate
          data-trace-id={`${TRACE}::EL-FORM-add-gallery-folder`}
        >
          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label" htmlFor="gallery-folder-name">
                Folder name <span className="dash-required">*</span>
              </label>
              <input
                id="gallery-folder-name"
                className="dash-input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Spring Collection"
                disabled={adding}
                autoFocus
                data-trace-id={`${TRACE}::EL-INPUT-add-gallery-folder-name`}
              />
            </div>
          </div>
          {addError && <p className="dash-inline-error">{addError}</p>}
          <div className="dash-form-actions">
            <button type="submit" className="dash-btn-primary" disabled={adding}>
              {adding ? 'Creating…' : 'Create Folder'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => {
                setShowAddForm(false);
                setNewFolderName('');
                setAddError(null);
              }}
              disabled={adding}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="dash-gallery-layout">
        <div className="dash-card" data-trace-id={`${TRACE}::EL-REGION-gallery-folder-panel`}>
          <h2 className="dash-section-title">Folders</h2>
          {loading ? (
            <p className="dash-help-text">Loading folders…</p>
          ) : loadError ? (
            <div>
              <p className="dash-inline-error">{loadError}</p>
              <button className="dash-btn-secondary" onClick={loadFolders}>
                Retry
              </button>
            </div>
          ) : (
            <FolderList
              folders={folders}
              selectedId={selectedFolder?.id ?? null}
              onSelect={handleSelectFolder}
              onRename={handleRenameTopLevel}
              onDelete={handleDeleteTopLevel}
            />
          )}
        </div>

        <div className="dash-card" data-trace-id={`${TRACE}::EL-REGION-gallery-content-panel`}>
          {!selectedFolder ? (
            <p className="dash-help-text">Select a folder to view and upload photos or videos.</p>
          ) : (
            <>
              <h2 className="dash-section-title">{selectedFolder.name}</h2>

              <UploadDropzone folderId={selectedFolder.id} onUploaded={handleItemUploaded} />

              <h3 className="dash-section-subtitle">Items</h3>
              {itemsLoading ? (
                <p className="dash-help-text">Loading items…</p>
              ) : itemsError ? (
                <p className="dash-inline-error">{itemsError}</p>
              ) : (
                <ItemGrid
                  items={items}
                  onDelete={handleDeleteItem}
                  onPreview={setPreviewItem}
                  onRenameAlt={handleRenameItemAlt}
                />
              )}
            </>
          )}
        </div>
      </div>

      {previewItem && (
        <ItemPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      )}
    </>
  );
}
