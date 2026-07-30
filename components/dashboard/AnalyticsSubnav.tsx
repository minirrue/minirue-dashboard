'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The hallway between the analytics screens — same shape as
 * `CatalogSubnav.tsx` (specs/2026-07-23-catalogue-navigation): a `TABS`
 * array with a `match(path)` per tab, a pure exported `resolveActiveTab` so
 * the matching can be unit tested without rendering, a display `ORDER`
 * array separate from match order, and a `data-trace-id` on every link.
 *
 * Unlike the catalogue tabs, none of these paths are prefixes of each other
 * (`/analytics/pages` can never be mistaken for `/analytics/products`), so
 * there is no catalogue-style "which is the fallback" trap here — only the
 * bare `/analytics` (Overview) needs an exact match rather than a prefix
 * match, since every other tab's href also starts with `/analytics`.
 */

interface Tab {
  label: string;
  href: string;
  match: (path: string) => boolean;
}

const TABS: Tab[] = [
  {
    label: 'Overview',
    href: '/analytics',
    match: (p) => p === '/analytics' || p === '/analytics/',
  },
  {
    label: 'Realtime',
    href: '/analytics/realtime',
    match: (p) => p.startsWith('/analytics/realtime'),
  },
  {
    label: 'Visitors',
    href: '/analytics/visitors',
    match: (p) => p.startsWith('/analytics/visitors'),
  },
  {
    label: 'Pages',
    href: '/analytics/pages',
    match: (p) => p.startsWith('/analytics/pages'),
  },
  {
    label: 'Products',
    href: '/analytics/products',
    match: (p) => p.startsWith('/analytics/products'),
  },
  {
    label: 'Acquisition',
    href: '/analytics/acquisition',
    match: (p) => p.startsWith('/analytics/acquisition'),
  },
  {
    label: 'Checkout',
    href: '/analytics/checkout',
    match: (p) => p.startsWith('/analytics/checkout'),
  },
  {
    label: 'Events',
    href: '/analytics/events',
    match: (p) => p.startsWith('/analytics/events'),
  },
];

/** Display order, left to right — not the match order. */
const ORDER = [
  'Overview',
  'Realtime',
  'Visitors',
  'Pages',
  'Products',
  'Acquisition',
  'Checkout',
  'Events',
];

/**
 * Which tab owns this path. Exported and pure so every route (including the
 * two dynamic detail routes, `/analytics/visitors/:id` and
 * `/analytics/products/:id`) can be pinned to the right tab without
 * rendering — mirrors `CatalogSubnav.resolveActiveTab`.
 */
export function resolveActiveTab(path: string): string {
  // normalizeDashboardPath strips a /dashboard prefix; internal links never
  // carry it, but be tolerant of a direct hit on the app-router path.
  const p = path.replace(/^\/dashboard(?=\/)/, '');
  return TABS.find((t) => t.match(p))?.label ?? 'Overview';
}

/** The tabs, in display order — exported for the same test. */
export const ANALYTICS_TAB_LABELS = ORDER;

export default function AnalyticsSubnav() {
  const pathname = usePathname() ?? '/analytics';
  const current = resolveActiveTab(pathname);

  const ordered = ORDER.map((label) => TABS.find((t) => t.label === label)!);

  return (
    <nav
      className="dash-catalog-subnav"
      aria-label="Analytics sections"
      data-trace-id="PG-DASHBOARD-ANL-000::EL-NAV-analytics-subnav"
    >
      {ordered.map((tab) => {
        const isActive = tab.label === current;
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={
              isActive
                ? 'dash-catalog-subnav-link is-active'
                : 'dash-catalog-subnav-link'
            }
            aria-current={isActive ? 'page' : undefined}
            data-trace-id={`PG-DASHBOARD-ANL-000::EL-LINK-subnav-${tab.label
              .toLowerCase()
              .replace(/\s+/g, '-')}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
