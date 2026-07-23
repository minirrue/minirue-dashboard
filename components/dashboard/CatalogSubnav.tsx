'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The hallway between the catalogue screens.
 * specs/2026-07-23-catalogue-navigation
 *
 * Products, Categories, Brands and Global variants were four dead-end screens
 * you reached by scattered buttons and left with the back button. This bar sits
 * at the top of all of them (plus the new Overview map), so they read as one
 * area with rooms instead of a maze — you always know where you are and can
 * move in one click.
 */

interface Tab {
  label: string;
  href: string;
  /** True when the current path belongs to this tab. Most-specific first. */
  match: (path: string) => boolean;
}

const TABS: Tab[] = [
  {
    label: 'Overview',
    href: '/catalogue',
    match: (p) => p === '/catalogue',
  },
  {
    label: 'Brands',
    href: '/catalogue/brands',
    match: (p) => p.startsWith('/catalogue/brands'),
  },
  {
    label: 'Global variants',
    href: '/catalogue/global-variants',
    match: (p) => p.startsWith('/catalogue/global-variants'),
  },
  {
    label: 'Categories',
    href: '/catalogue/categories',
    match: (p) => p.startsWith('/catalogue/categories'),
  },
  {
    // Fallback: anything else under /catalogue (the list, New, Edit) is
    // Products. Listed last so the more specific sub-tabs above win.
    label: 'Products',
    href: '/catalogue/products',
    match: (p) => p.startsWith('/catalogue/products') || p === '/catalogue/',
  },
];

/** Display order, left to right — not the match order. */
const ORDER = ['Overview', 'Products', 'Categories', 'Brands', 'Global variants'];

/**
 * Which tab owns this path. Exported and pure so the /products/brands vs
 * /products trap can be tested without rendering — that ambiguity is the whole
 * reason this is not a one-line startsWith.
 */
export function resolveActiveTab(path: string): string {
  // normalizeDashboardPath strips a /dashboard prefix; internal links never
  // carry it, but be tolerant of a direct hit on the app-router path.
  const p = path.replace(/^\/dashboard(?=\/)/, '');
  return TABS.find((t) => t.match(p))?.label ?? 'Products';
}

/** The tabs, in display order — exported for the same test. */
export const CATALOG_TAB_LABELS = ORDER;

export default function CatalogSubnav() {
  const pathname = usePathname() ?? '/products';
  const current = resolveActiveTab(pathname);

  const ordered = ORDER.map((label) => TABS.find((t) => t.label === label)!);

  return (
    <nav
      className="dash-catalog-subnav"
      aria-label="Catalogue sections"
      data-trace-id="PG-DASHBOARD-CAT-000::EL-NAV-catalog-subnav"
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
            data-trace-id={`PG-DASHBOARD-CAT-000::EL-LINK-subnav-${tab.label
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
