'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { listFolders } from '@/lib/gallery/api';
import type { GalleryFolder } from '@/lib/gallery/types';

const TRACE = 'CMP-DASHBOARD-GALLERY-TREE';

/**
 * The whole gallery, one rail, expandable in place.
 *
 * Replaces a flat one-level-at-a-time list where every row carried its own
 * Open / Rename / Delete buttons. Two things were wrong with that: nothing on
 * screen showed the SHAPE of the tree (an operator could not see that Perfumes
 * lived inside All Products without walking into it), and the stacked
 * button-triples made each row read as a card inside a card.
 *
 * Children load on first expand and are cached per node, so opening a deep
 * folder twice costs one request, and the root never re-fetches to draw a leaf.
 */

export interface FolderTreeProps {
  /** Currently selected folder, or null for none. */
  selectedId: string | null;
  /** Single click — show this folder's contents on the right. */
  onSelect: (folder: GalleryFolder, path: GalleryFolder[]) => void;
  /**
   * Bumped by the page whenever folders are created, renamed or deleted, so the
   * rail refetches the levels it is showing. A tree that caches children has to
   * be told when the server's answer changed.
   */
  refreshToken: number;
}

interface NodeProps extends FolderTreeProps {
  folder: GalleryFolder;
  depth: number;
  /** Ancestors of `folder`, root first — what the right pane shows as a crumb. */
  path: GalleryFolder[];
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform var(--mr-dur-fast, 160ms) var(--mr-ease-out, ease-out)',
      }}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function FolderGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

function TreeNode({
  folder,
  depth,
  path,
  selectedId,
  onSelect,
  refreshToken,
}: NodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<GalleryFolder[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setChildren(await listFolders(folder.id));
    } catch {
      // A branch that will not load must not take the rail down; it stays
      // collapsed and the row still selects.
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [folder.id]);

  // Refetch an OPEN branch when the page says folders changed. A collapsed
  // branch is left alone — it will load fresh whenever it is opened.
  useEffect(() => {
    if (expanded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next && children === null) load();
  }, [expanded, children, load]);

  const isSelected = selectedId === folder.id;
  const childPath = [...path, folder];

  return (
    <li>
      <div
        className="dash-gallery-tree-row"
        data-active={isSelected ? 'true' : undefined}
        style={{ paddingLeft: 8 + depth * 14 }}
        role="treeitem"
        aria-expanded={expanded}
        aria-selected={isSelected}
        tabIndex={0}
        // Single click selects; DOUBLE click opens, which is the desktop
        // file-manager convention the owner asked for (2026-08-03) and replaces
        // a per-row "Open" link.
        onClick={() => onSelect(folder, path)}
        onDoubleClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(folder, path);
          } else if (e.key === 'ArrowRight' && !expanded) {
            e.preventDefault();
            toggle();
          } else if (e.key === 'ArrowLeft' && expanded) {
            e.preventDefault();
            toggle();
          }
        }}
        data-trace-id={`${TRACE}::EL-ROW-folder@${folder.id}`}
      >
        <button
          type="button"
          className="dash-gallery-tree-twisty"
          // The chevron is the only affordance that must not also select, or
          // expanding a branch would swap the right pane out from under you.
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-label={expanded ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
          tabIndex={-1}
        >
          <Chevron open={expanded} />
        </button>
        <span className="dash-gallery-tree-icon">
          <FolderGlyph />
        </span>
        <span className="dash-gallery-tree-name">{folder.name}</span>
        {/* Only meaningful for a folder that may hold media — a top-level
            folder's count is always 0 by design, and printing "0 photos" next to
            it reads as an error rather than a rule. */}
        {folder.parentId !== null && (
          <span className="dash-gallery-tree-count">{folder.itemCount}</span>
        )}
      </div>

      {expanded && (
        <ul role="group" className="dash-gallery-tree-group">
          {loading && children === null ? (
            <li className="dash-gallery-tree-hint" style={{ paddingLeft: 22 + depth * 14 }}>
              Loading…
            </li>
          ) : children && children.length === 0 ? (
            <li className="dash-gallery-tree-hint" style={{ paddingLeft: 22 + depth * 14 }}>
              {folder.parentId === null ? 'No folders inside yet' : 'No folders inside'}
            </li>
          ) : (
            (children ?? []).map((child) => (
              <TreeNode
                key={child.id}
                folder={child}
                depth={depth + 1}
                path={childPath}
                selectedId={selectedId}
                onSelect={onSelect}
                refreshToken={refreshToken}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

export default function FolderTree({
  selectedId,
  onSelect,
  refreshToken,
}: FolderTreeProps) {
  const [roots, setRoots] = useState<GalleryFolder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRoots(await listFolders());
    } catch {
      setError('Could not load folders.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  if (error) {
    return (
      <div>
        <p className="dash-inline-error">{error}</p>
        <button type="button" className="dash-btn-secondary" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  if (roots === null) {
    return <p className="dash-help-text">Loading folders…</p>;
  }

  if (roots.length === 0) {
    return (
      <p className="dash-help-text" style={{ marginTop: 0 }}>
        No folders yet. Make one to start — it holds the folders your photos go
        in.
      </p>
    );
  }

  return (
    <ul
      role="tree"
      aria-label="Gallery folders"
      className="dash-gallery-tree"
      data-trace-id={`${TRACE}::EL-TREE-folders`}
    >
      {roots.map((folder) => (
        <TreeNode
          key={folder.id}
          folder={folder}
          depth={0}
          path={[]}
          selectedId={selectedId}
          onSelect={onSelect}
          refreshToken={refreshToken}
        />
      ))}
    </ul>
  );
}
