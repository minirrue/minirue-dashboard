'use client';

import React, { useCallback, useState } from 'react';
import ImageField from '@/components/dashboard/ImageField';
import { apiGetSettings, apiUpdateSettings } from '@/lib/api/settings';
import {
  apiCollabGetBrand,
  apiCollabUpdateBrand,
} from '@/lib/api/collab-portal';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

/**
 * Cover pictures for the two shop-page tiles that are NOT categories —
 * "All Products" and "Bundles".
 *
 * WHY IT LIVES ON THE CATEGORIES SCREEN. It shipped first at the bottom of
 * Settings and the owner could not find it (2026-08-03: "where in dashboard
 * where i can set the all products image cover???"). These two tiles sit in the
 * same storefront grid as the category tiles and are managed with the same
 * gallery pictures, so the place an admin looks for them is next to the
 * categories — which is what the owner said in the first place.
 *
 * ONE COMPONENT FOR BOTH SCOPES, because the owner asked for one mindset across
 * MiniRue and collab. The only difference is which endpoint it talks to: the
 * house reads/writes the store settings, a partner its own brand profile. The
 * backend keeps them in different places (the house space has no row of its own)
 * but the behaviour, and now the UI, are identical.
 *
 * SAVES ON PICK, not on a Save button. There is no form to submit on this
 * screen, and a picker that silently needs a save elsewhere is the same class of
 * problem as burying it in Settings was.
 */
export default function ShopPanelTiles({
  scope,
  traceId,
}: {
  /** `house` = MiniRue's own space, `collab` = the signed-in partner's. */
  scope: 'house' | 'collab';
  traceId?: string;
}) {
  const [covers, setCovers] = useState<{
    allProductsImageMediaId: string | null;
    bundlesImageMediaId: string | null;
    allProductsImageUrl: string | null;
    bundlesImageUrl: string | null;
  }>({
    allProductsImageMediaId: null,
    bundlesImageMediaId: null,
    allProductsImageUrl: null,
    bundlesImageUrl: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      if (scope === 'house') {
        const s = await apiGetSettings();
        setCovers({
          allProductsImageMediaId: s.shopPanel?.allProductsImageMediaId ?? null,
          bundlesImageMediaId: s.shopPanel?.bundlesImageMediaId ?? null,
          allProductsImageUrl: s.shopPanelImages?.allProductsImageUrl ?? null,
          bundlesImageUrl: s.shopPanelImages?.bundlesImageUrl ?? null,
        });
      } else {
        const b = await apiCollabGetBrand();
        setCovers({
          allProductsImageMediaId: b.allProductsImageMediaId ?? null,
          bundlesImageMediaId: b.bundlesImageMediaId ?? null,
          allProductsImageUrl: b.allProductsImageUrl ?? null,
          bundlesImageUrl: b.bundlesImageUrl ?? null,
        });
      }
    } catch (e) {
      // A cover picker that cannot load must not take the Categories screen
      // down — that screen's real job is the category list.
      setError((e as ApiError).message ?? 'Could not load the tile pictures');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useMountedEffect(() => {
    load();
  }, [load]);

  /**
   * Persists immediately. Both ids are sent every time so what the screen shows
   * and what is stored cannot drift apart, and the response is re-seeded so the
   * tile draws the server's freshly-resolved URL rather than whatever the picker
   * happened to hold.
   */
  const persist = useCallback(
    async (next: {
      allProductsImageMediaId: string | null;
      bundlesImageMediaId: string | null;
    }) => {
      setSaving(true);
      setError(null);
      setSaved(false);
      try {
        if (scope === 'house') {
          const updated = await apiUpdateSettings({ shopPanel: next });
          setCovers({
            allProductsImageMediaId:
              updated.shopPanel?.allProductsImageMediaId ?? null,
            bundlesImageMediaId: updated.shopPanel?.bundlesImageMediaId ?? null,
            allProductsImageUrl:
              updated.shopPanelImages?.allProductsImageUrl ?? null,
            bundlesImageUrl: updated.shopPanelImages?.bundlesImageUrl ?? null,
          });
        } else {
          const updated = await apiCollabUpdateBrand(next);
          setCovers({
            allProductsImageMediaId: updated.allProductsImageMediaId ?? null,
            bundlesImageMediaId: updated.bundlesImageMediaId ?? null,
            allProductsImageUrl: updated.allProductsImageUrl ?? null,
            bundlesImageUrl: updated.bundlesImageUrl ?? null,
          });
        }
        setSaved(true);
      } catch (e) {
        setError((e as ApiError).message ?? 'Could not save the tile picture');
        // Re-read so the tiles show what is ACTUALLY stored rather than the
        // optimistic pick that just failed.
        load();
      } finally {
        setSaving(false);
      }
    },
    [scope, load],
  );

  const pick = (which: 'allProducts' | 'bundles') => (
    mediaId: string | null,
    item: { url?: string } | null,
  ) => {
    const next = {
      allProductsImageMediaId:
        which === 'allProducts' ? mediaId : covers.allProductsImageMediaId,
      bundlesImageMediaId:
        which === 'bundles' ? mediaId : covers.bundlesImageMediaId,
    };
    // Draw it at once from the bytes the picker already has, then confirm with
    // the server — the same never-a-cold-miss reasoning as the avatar tiles.
    setCovers((c) => ({
      ...c,
      ...next,
      ...(which === 'allProducts'
        ? { allProductsImageUrl: item?.url ?? null }
        : { bundlesImageUrl: item?.url ?? null }),
    }));
    persist(next);
  };

  return (
    <div className="dash-form-section" data-trace-id={traceId}>
      <h3 className="dash-section-title">Shop page tiles</h3>
      <p className="dash-help-text" style={{ marginTop: 0 }}>
        {scope === 'house'
          ? 'The two shortcut tiles on the shop page, beside your categories. Leave one without a picture to show its icon instead.'
          : 'The shortcut tiles on your space, beside your categories. Leave one without a picture to show its icon instead.'}
        {saving ? ' Saving…' : saved ? ' Saved.' : ''}
      </p>

      {error && <p className="dash-inline-error">{error}</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <ImageField
          label="All Products tile"
          helpText={
            scope === 'house'
              ? 'Leads to every product in the shop.'
              : 'Leads to everything you sell.'
          }
          imageUrl={covers.allProductsImageUrl}
          mediaId={covers.allProductsImageMediaId}
          disabled={loading || saving}
          onChange={pick('allProducts')}
        />
        <ImageField
          label="Bundles tile"
          helpText="Only appears while a bundle is live."
          imageUrl={covers.bundlesImageUrl}
          mediaId={covers.bundlesImageMediaId}
          disabled={loading || saving}
          onChange={pick('bundles')}
        />
      </div>
    </div>
  );
}
