'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createFolder,
  deleteFolder,
  deleteItem,
  exchangeItem,
  listFolders,
  listItems,
  renameFolder,
  searchGallery,
  updateItemAltText,
  uploadItem } from '@/lib/gallery/api';
import type { GalleryFolder, GalleryItem, GallerySearchResult } from '@/lib/gallery/types';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';
import UploadPreviewImage from '@/components/dashboard/UploadPreviewImage';
import { useUser } from '@/lib/hooks/use-auth';
import { Role } from '@/lib/auth/role';
import {
  listDeletedMedia,
  restoreProductMedia,
  type DeletedMediaItem,
} from '@/lib/catalog/api';

const TRACE = 'PG-DASHBOARD-GAL-001';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Task 39 — "make superadmin see soft deleted images in gallery section for
 * super admin only". A soft-deleted product image (media_assets, not a
 * gallery_items row — see MediaSection.tsx's `handleDelete`) disappears from
 * everywhere else the moment it's deleted; this is the ONE place it is
 * still visible, clearly marked, and restorable. Not rendered at all unless
 * the caller is SUPERADMIN — the parent only mounts this component after
 * confirming that, and the server itself 403s the request anyway
 * (CatalogService.listDeletedMedia), so there is no path that leaks a
 * deleted image to anyone else even if this were reused incorrectly.
 */
function DeletedImagesPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DeletedMediaItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await listDeletedMedia());
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Failed to load deleted images.');
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) void load();
  }

  async function handleRestore(item: DeletedMediaItem) {
    setRestoringId(item.id);
    try {
      await restoreProductMedia(item.productId, item.id);
      setItems((prev) => (prev ? prev.filter((m) => m.id !== item.id) : prev));
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Failed to restore image.');
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div
      className="dash-card"
      style={{ marginBottom: 16 }}
      data-trace-id={`${TRACE}::EL-REGION-deleted-images`}
    >
      <button
        type="button"
        className="dash-btn-ghost"
        onClick={toggle}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'space-between' }}
        data-trace-id={`${TRACE}::EL-BTN-toggle-deleted-images`}
      >
        <span style={{ color: 'var(--mr-dash-danger, #b3261e)', fontWeight: 600 }}>
          Deleted images{items ? ` (${items.length})` : ''}
        </span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          <p className="dash-help-text" style={{ marginTop: 0 }}>
            Soft-deleted product images — hidden from the storefront, admin and
            collaborator screens. Only super admin can see this list. Restoring
            an image puts it straight back on its product.
          </p>
          {loading ? (
            <p className="dash-help-text">Loading…</p>
          ) : error ? (
            <p className="dash-inline-error">{error}</p>
          ) : !items || items.length === 0 ? (
            <p className="dash-help-text">No deleted images.</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 16,
              }}
            >
              {items.map((m) => (
                <figure key={m.id} style={{ margin: 0, opacity: 0.6 }}>
                  {m.url ? (
                    <UploadPreviewImage
                      src={m.url}
                      localFile={null}
                      alt={m.altText ?? ''}
                      style={{
                        width: '100%',
                        aspectRatio: '4/5',
                        objectFit: 'cover',
                        borderRadius: 'var(--mr-radius-sm)',
                        border: '1px dashed var(--mr-dash-danger, #b3261e)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '4/5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px dashed var(--mr-dash-danger, #b3261e)',
                        borderRadius: 'var(--mr-radius-sm)',
                        fontSize: 11,
                        color: 'var(--mr-ink-400)',
                      }}
                    >
                      No preview
                    </div>
                  )}
                  <figcaption className="dash-help-text" style={{ marginTop: 6, fontSize: 11 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{m.productName}</span>
                    <span style={{ display: 'block' }}>{m.role}</span>
                    <button
                      type="button"
                      className="dash-btn-ghost"
                      style={{ display: 'block', padding: '2px 0', fontSize: 11 }}
                      disabled={restoringId !== null}
                      onClick={() => handleRestore(m)}
                      data-trace-id={`${TRACE}::EL-BTN-restore-deleted-image@${m.id}`}
                    >
                      {restoringId === m.id ? 'Restoring…' : 'Restore'}
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Folder list (top-level or one level of children) ── */
interface FolderListProps {
  folders: GalleryFolder[];
  selectedId: string | null;
  onSelect: (folder: GalleryFolder) => void;
  onOpen: (folder: GalleryFolder) => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function FolderRow({
  folder,
  selected,
  onSelect,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: GalleryFolder;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
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
        {/* Open steps INTO the folder to show its subfolders; clicking the
            folder name still selects it to show its images. Two different
            things, so two controls rather than one overloaded click. */}
        <button
          type="button"
          className="dash-btn-ghost"
          onClick={onOpen}
          disabled={busy}
          data-trace-id={`${TRACE}::EL-BTN-open-gallery-folder@${folder.id}`}
        >
          Open
        </button>
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

function FolderList({ folders, selectedId, onSelect, onOpen, onRename, onDelete }: FolderListProps) {
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
          onOpen={() => onOpen(folder)}
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
  onUploaded: (item: GalleryItem, file: File) => void;
}

function UploadDropzone({ folderId, onUploaded }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cropImage = useImageCrop();

  const upload = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          // Crop step first — same modal and presets as every other upload.
          // Cancelling the crop skips that file rather than uploading it raw.
          const cropped = await cropImage(file, { title: `Crop ${file.name}` });
          if (!cropped) continue;
          const item = await uploadItem(folderId, cropped);
          onUploaded(item, cropped);
        }
      } catch (e) {
        const err = e as ApiError;
        setError(err.message ?? 'Upload failed.');
      } finally {
        setUploading(false);
      }
    },
    [folderId, onUploaded, cropImage],
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
  onExchange,
  exchangingId,
  localFiles,
}: {
  items: GalleryItem[];
  onDelete: (id: string) => Promise<void>;
  onPreview: (item: GalleryItem) => void;
  onRenameAlt: (id: string, altText: string) => Promise<void>;
  onExchange: (id: string, file: File) => void;
  exchangingId: string | null;
  /** Cropped bytes for items uploaded or exchanged THIS session, keyed by
   *  item id — lets the thumbnail render from local bytes instead of a
   *  guaranteed-cold-miss remote fetch. Items already in the folder on first
   *  paint have no entry and fall back to plain retry. */
  localFiles: Record<string, File>;
}) {
  // One shared hidden input, retargeted per card via a ref map — matches
  // MediaSection.tsx's pattern for "Exchange" (task-w2.3-brief.md, Part A)
  // rather than one <input> per card.
  const exchangeInputRef = useRef<HTMLInputElement>(null);
  const [exchangeTargetId, setExchangeTargetId] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="dash-help-text">No items in this folder yet.</p>;
  }
  return (
    <div className="dash-gallery-item-grid" data-trace-id={`${TRACE}::EL-GRID-gallery-items`}>
      <input
        ref={exchangeInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && exchangeTargetId) onExchange(exchangeTargetId, file);
          e.target.value = '';
        }}
        data-trace-id={`${TRACE}::EL-INPUT-gallery-item-exchange-file`}
      />
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
              <UploadPreviewImage
                src={item.url}
                localFile={localFiles[item.id] ?? null}
                alt={item.altText ?? ''}
                className="dash-gallery-item-media"
              />
            )}
          </button>
          <AltTextField item={item} onSave={(altText) => onRenameAlt(item.id, altText)} />
          <div className="dash-gallery-item-meta">
            <span>{formatDate(item.createdAt)}</span>
            <button
              type="button"
              className="dash-btn-ghost"
              disabled={exchangingId !== null}
              onClick={() => {
                setExchangeTargetId(item.id);
                exchangeInputRef.current?.click();
              }}
              title="Replace this photo — everywhere it's used updates automatically"
              data-trace-id={`${TRACE}::EL-BTN-exchange-gallery-item@${item.id}`}
            >
              {exchangingId === item.id ? 'Exchanging…' : 'Exchange'}
            </button>
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
  const cropImage = useImageCrop();
  // Task 39: the Deleted images panel is SUPERADMIN-only — gated here (never
  // mounted, so it never fires the request) AND on the server
  // (CatalogService.listDeletedMedia 403s anyone else regardless).
  const { data: user } = useUser();
  const isSuperAdmin = user?.role === Role.SUPERADMIN;
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedFolder, setSelectedFolder] = useState<GalleryFolder | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  /**
   * What sits inside the selected folder.
   *
   * A top-level folder cannot hold photos, so showing it an Items list meant
   * showing an empty grid every time — the panel said "nothing here" about a
   * folder that might hold six subfolders. This is what goes there instead.
   */
  const [childFolders, setChildFolders] = useState<GalleryFolder[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);

  // "Exchange" (task-w2.3-brief.md, Part A) — which item card is mid-replace,
  // shown as a busy state on its own button.
  const [exchangingId, setExchangingId] = useState<string | null>(null);

  // Task FF (2026-07-30): cropped bytes for an item uploaded or exchanged
  // THIS session, keyed by item id — see ItemGrid's `localFiles` prop.
  const [pendingLocalFiles, setPendingLocalFiles] = useState<Record<string, File>>({});

  // Gallery search (task-w2.3-brief.md, Part B) — overlays the normal
  // folder-browsing panel while a query is present; an empty query goes
  // straight back to it.
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<GallerySearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const isSearching = query.trim().length > 0;

  /**
   * Where in the tree we are. `[]` is the top level; each entry is a folder we
   * have opened. The backend has supported nested folders since the module
   * shipped — listFolders(parentId) and createFolder({parentId}) both take one
   * and are covered by tests — and this screen simply never passed it, so
   * every folder was forced to the top level.
   */
  const [folderPath, setFolderPath] = useState<GalleryFolder[]>([]);
  const currentParent = folderPath.length
    ? folderPath[folderPath.length - 1]
    : null;

  const loadFolders = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await listFolders(currentParent?.id);
      setFolders(res);
    } catch (e) {
      const err = e as ApiError;
      setLoadError(err.message ?? 'Failed to load gallery folders.');
    } finally {
      setLoading(false);
    }
  }, [currentParent?.id]);

  useMountedEffect(() => {
    loadFolders();
  }, [loadFolders]);

  /** Step into a folder: it becomes the new parent and we list its children. */
  function enterFolder(folder: GalleryFolder) {
    setFolderPath((prev) => [...prev, folder]);
    setSelectedFolder(null);
    setItems([]);
    setShowAddForm(false);
  }

  /** Jump to a point in the breadcrumb. `-1` is the top level. */
  function goToDepth(depth: number) {
    setFolderPath((prev) => prev.slice(0, depth + 1));
    setSelectedFolder(null);
    setItems([]);
    setShowAddForm(false);
  }

  const loadFolderContents = useCallback(async (folder: GalleryFolder) => {
    // A top-level folder shows its subfolders; a subfolder shows its photos.
    // Only one of the two requests is ever worth making.
    if (!folder.parentId) {
      setChildrenLoading(true);
      setItems([]);
      try {
        setChildFolders(await listFolders(folder.id));
      } catch {
        // The tree is a navigation aid, not the page — an empty one with the
        // folder still selected beats an error where the folders should be.
        setChildFolders([]);
      } finally {
        setChildrenLoading(false);
      }
      return;
    }

    setChildFolders([]);
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
      // Created inside whatever folder is open, which is what makes a tree
      // rather than a flat list.
      await createFolder({
        name: newFolderName.trim(),
        parentId: currentParent?.id,
      });
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

  function handleItemUploaded(item: GalleryItem, file: File) {
    setItems((prev) => [item, ...prev]);
    setFolders((prev) =>
      prev.map((f) => (f.id === item.folderId ? { ...f, itemCount: f.itemCount + 1 } : f)),
    );
    setPendingLocalFiles((prev) => ({ ...prev, [item.id]: file }));
  }

  /**
   * "Exchange" — the id, folder and alt text stay put; only the picture or
   * video changes (task-w2.3-brief.md, Part A). The item count never moves —
   * this replaces a photo, it doesn't add or remove one.
   *
   * Crops before uploading, same free-crop step UploadDropzone already uses
   * for a brand-new item — Exchange used to call exchangeItem directly,
   * skipping the crop that adding a fresh photo never skips. (Non-image
   * files, i.e. video, pass through cropImage untouched — see
   * ImageCropProvider.)
   */
  async function handleExchangeItem(id: string, file: File) {
    setExchangingId(id);
    try {
      const cropped = await cropImage(file, { title: `Crop replacement for ${file.name}` });
      if (!cropped) return;
      const updated = await exchangeItem(id, cropped);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setPendingLocalFiles((prev) => ({ ...prev, [id]: cropped }));
    } catch (e) {
      const err = e as ApiError;
      setItemsError(err.message ?? 'Failed to exchange item.');
    } finally {
      setExchangingId(null);
    }
  }

  /** Empty query returns to normal folder browsing — search overlays it,
   * never replaces it permanently. */
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

  /** Jump straight to a search hit's folder and clear the query — same
   * "step into the folder that owns this result" behaviour whether the hit
   * was a folder or an item. */
  function goToSearchResultFolder(folder: GalleryFolder) {
    setQuery('');
    setSearchResult(null);
    setSelectedFolder(folder);
    loadFolderContents(folder);
  }

  return (
    <>
      <div className="dash-page-header" data-trace-id={`${TRACE}::EL-REGION-gallery-page-header`}>
        <h1 className="dash-page-title">Gallery</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
      </div>

      {isSuperAdmin && <DeletedImagesPanel />}

      <div style={{ marginBottom: 16, maxWidth: 420 }}>
        <input
          type="search"
          className="dash-input"
          placeholder="Search photos, videos and folders…"
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          data-trace-id={`${TRACE}::EL-INPUT-gallery-search`}
        />
      </div>

      {isSearching ? (
        <div className="dash-card" data-trace-id={`${TRACE}::EL-REGION-gallery-search-results`}>
          <h2 className="dash-section-title">Search results</h2>
          {searching ? (
            <p className="dash-help-text">Searching…</p>
          ) : searchError ? (
            <p className="dash-inline-error">{searchError}</p>
          ) : !searchResult || (searchResult.items.length === 0 && searchResult.folders.length === 0) ? (
            <p className="dash-help-text">No matches for &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            <>
              {searchResult.folders.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 className="dash-section-subtitle">Folders</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {searchResult.folders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        className="dash-btn-ghost"
                        style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                        onClick={() => goToSearchResultFolder(folder)}
                        data-trace-id={`${TRACE}::EL-BTN-search-result-folder@${folder.id}`}
                      >
                        📁 {folder.breadcrumb.join(' / ') || folder.name} ({folder.itemCount})
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchResult.items.length > 0 && (
                <div>
                  <h3 className="dash-section-subtitle">Photos &amp; videos</h3>
                  <div
                    className="dash-gallery-item-grid"
                    data-trace-id={`${TRACE}::EL-GRID-gallery-search-result-items`}
                  >
                    {searchResult.items.map((item) => (
                      <div key={item.id} className="dash-gallery-item-card">
                        <button
                          type="button"
                          className="dash-gallery-item-media-btn"
                          onClick={() => setPreviewItem(item)}
                          aria-label="View full size"
                          title={item.breadcrumb.join(' / ')}
                          data-trace-id={`${TRACE}::EL-BTN-preview-search-result-item@${item.id}`}
                        >
                          {item.kind === 'video' ? (
                            <video src={item.url} className="dash-gallery-item-media" muted />
                          ) : (
                            <UploadPreviewImage
                              src={item.url}
                              alt={item.altText ?? ''}
                              className="dash-gallery-item-media"
                            />
                          )}
                        </button>
                        <p
                          className="dash-help-text"
                          style={{
                            margin: '4px 0 0',
                            fontSize: 11,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.breadcrumb.join(' / ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
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
          {/* Where we are in the tree. Always shows "All folders" as the root
              so there is a way back even one level deep. */}
          <nav className="dash-gallery-breadcrumb" aria-label="Folder path">
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => goToDepth(-1)}
              disabled={folderPath.length === 0}
            >
              All folders
            </button>
            {folderPath.map((f, i) => (
              <span key={f.id} className="dash-gallery-breadcrumb-step">
                <span aria-hidden="true">/</span>
                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={() => goToDepth(i)}
                  disabled={i === folderPath.length - 1}
                >
                  {f.name}
                </button>
              </span>
            ))}
          </nav>
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
              onOpen={enterFolder}
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

              {/* Owner rule 2026-07-29: a top-level folder holds folders, not
                  files. Uploading into one is what turned the gallery into a
                  flat pile in the first place — the level exists to group, and
                  something dropped straight into it belongs to no group. */}
              {selectedFolder.parentId ? (
                <>
                  <UploadDropzone
                    folderId={selectedFolder.id}
                    onUploaded={handleItemUploaded}
                  />
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
                      onExchange={handleExchangeItem}
                      exchangingId={exchangingId}
                      localFiles={pendingLocalFiles}
                    />
                  )}
                </>
              ) : childrenLoading ? (
                <p className="dash-help-text">Loading…</p>
              ) : childFolders.length === 0 ? (
                <p className="dash-help-text" style={{ marginTop: 0 }}>
                  Nothing inside <strong>{selectedFolder.name}</strong> yet. Open it
                  and make a folder — photos go in there, not here.
                </p>
              ) : (
                /* The tree. A top-level folder holds folders, so this is what
                   belongs in the panel — an Items grid here was always empty by
                   construction, which read as "this folder is empty" about a
                   folder that might hold six subfolders. */
                <ul className="dash-gallery-tree" aria-label={`Inside ${selectedFolder.name}`}>
                  {childFolders.map((child) => (
                    <li key={child.id}>
                      <button
                        type="button"
                        className="dash-gallery-tree-row"
                        onClick={() => {
                          // Step INTO the parent, so the folder list on the left
                          // and the breadcrumb agree with what is now selected.
                          // Selecting the child without moving the path would
                          // show a folder that is not in the visible list.
                          setFolderPath((prev) => [...prev, selectedFolder]);
                          setSelectedFolder(child);
                          loadFolderContents(child);
                        }}
                      >
                        <span className="dash-gallery-tree-icon" aria-hidden="true">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                          </svg>
                        </span>
                        <span className="dash-gallery-tree-name">{child.name}</span>
                        <span className="dash-gallery-tree-count">
                          {child.itemCount} {child.itemCount === 1 ? 'photo' : 'photos'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
        </>
      )}

      {previewItem && (
        <ItemPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      )}
    </>
  );
}
