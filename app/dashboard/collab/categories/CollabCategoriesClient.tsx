'use client';

import React, { useCallback, useState } from 'react';
import {
  apiCollabCategories,
  apiCollabCreateCategory,
  apiCollabDeleteCategory,
  apiCollabUpdateCategory,
  type CollabCategory,
} from '@/lib/api/collab-portal';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import CategoryTree, { type CategoryTreeApi } from '@/app/dashboard/categories/CategoryTree';
import NewCategoryForm from '@/app/dashboard/categories/NewCategoryForm';
import ShopPanelTiles from '@/components/dashboard/ShopPanelTiles';

const TRACE = 'PG-COLLAB-CATEGORIES-001';

/**
 * A partner's own categories.
 *
 * Each space keeps its own list (owner decision, 2026-07-29) — Helia's
 * "Perfumes" and MiniRue's are two different things that may share a name.
 * There is no space to choose here: the backend takes it from whoever is
 * signed in, so a partner can only ever see and change their own.
 *
 * Renders the SAME tree component MiniRue's own Categories tab uses (Task 20)
 * — nesting, rename, delete, and the mandatory 1:1-cropped image are all one
 * implementation, not a second copy that quietly drifts from the first. Only
 * the API bindings below differ: they go to `/collab/categories`, which the
 * backend already scopes to whoever is signed in, never to a space this
 * screen names itself.
 */
export default function CollabCategoriesClient() {
  const [categories, setCategories] = useState<CollabCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiCollabCategories();
      setCategories(res.data ?? []);
    } catch (e) {
      setLoadError((e as ApiError).message ?? 'Could not load your categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => {
    void load();
  }, [load]);

  function handleCategoryUpdated(updated: CollabCategory) {
    setCategories((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...updated, children: c.children } : c)),
    );
  }

  const api: CategoryTreeApi<CollabCategory> = {
    update: (id, data) =>
      apiCollabUpdateCategory(id, {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
        ...(data.imageMediaId !== undefined ? { image_media_id: data.imageMediaId } : {}),
      }),
    remove: (id) => apiCollabDeleteCategory(id),
  };

  return (
    <div data-trace-id={`${TRACE}::EL-REGION-collab-categories-page`}>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Categories</h1>
      </div>

      <p className="dash-help-text" style={{ marginBottom: 16 }}>
        Your own categories. They appear on your shop page and are how shoppers
        browse what you sell. MiniRue&apos;s categories are separate — yours are
        yours to name.
      </p>

      {/* Same component, same place as MiniRue's own — the owner asked for one
          mindset across MiniRue and collab. It writes to this partner's own
          brand profile, and its gallery picker can only see this partner's
          pictures. */}
      <ShopPanelTiles scope="collab" />

      <NewCategoryForm
        parentOptions={[]}
        showSlugField={false}
        showSortOrderField={false}
        traceId={TRACE}
        onCreate={async (input) => {
          // The collab create endpoint doesn't take an image directly — the
          // form still refuses to submit without one, so attach it right
          // after in a second call rather than loosening the rule.
          const created = await apiCollabCreateCategory({
            name: input.name,
            parent_id: input.parentId,
          });
          return apiCollabUpdateCategory(created.id, { image_media_id: input.imageMediaId });
        }}
        onCreated={load}
      />

      {loading ? (
        <p className="dash-help-text">Loading your categories…</p>
      ) : loadError ? (
        <div className="dash-card">
          <p className="dash-inline-error">{loadError}</p>
          <button className="dash-btn-secondary" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : (
        <CategoryTree
          categories={categories}
          api={api}
          showSlugField={false}
          onCategoryUpdated={handleCategoryUpdated}
          onCategoryDeleted={load}
        />
      )}
    </div>
  );
}
