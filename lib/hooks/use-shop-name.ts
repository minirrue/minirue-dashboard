'use client';

import { useEffect, useState } from 'react';
import { apiGetPublicSettings } from '@/lib/api/settings';

/**
 * The ONE shop display name (2026-07-31 owner ask: "unify the name of
 * anything related to minirue even dropdowns or anything by one single
 * input field please from settings... so customer can't see mini rue and
 * MiniRue and MINIRUE in different places" — and "the staff has same name
 * inherit from the main single admin").
 *
 * Every hardcoded "MiniRue" literal in this app's chrome (sidebar wordmark,
 * the support desk dropdown, DashChatView's brand label, the login screen…)
 * must read this hook instead, so a rename in Settings reaches every one of
 * them at once. Backed by the PUBLIC settings endpoint (not the authenticated
 * `/settings`) so it works on the login screen too, before a session exists.
 *
 * Deliberately excluded, per the owner's own carve-out: the browser TAB
 * title (`export const metadata = { title: ... }` in each page.tsx / the
 * root layout) stays hardcoded — "any hardcoded name except the storefront
 * dashboard tab". That is a build-time string Next.js needs statically; this
 * hook is for on-page, run-time text.
 *
 * Deliberately plain `useState`/`useEffect`, NOT `useClientQuery`/react-query
 * (unlike most reads in this app): this hook is called from chrome-level
 * components (DashboardLayoutClient, DashboardSidebar, the login screen)
 * that a good number of this app's own component tests mount WITHOUT a
 * `QueryClientProvider` in the tree — `useQuery` there throws "No QueryClient
 * set" and takes the whole test down. A module-level cache below still
 * avoids a duplicate fetch per component on a real page.
 */
const DEFAULT_SHOP_NAME = 'MiniRue';

let cached: string | null = null;
let inFlight: Promise<string> | null = null;

function fetchShopName(): Promise<string> {
  if (cached !== null) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = apiGetPublicSettings()
      .then((s) => {
        cached = s.displayName || DEFAULT_SHOP_NAME;
        return cached;
      })
      .catch(() => DEFAULT_SHOP_NAME)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useShopName(): string {
  const [name, setName] = useState(cached ?? DEFAULT_SHOP_NAME);

  useEffect(() => {
    let cancelled = false;
    fetchShopName().then((resolved) => {
      if (!cancelled) setName(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return name;
}
