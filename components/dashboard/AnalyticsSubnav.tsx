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
    // The original analytics screen, kept rather than replaced. It answers a
    // different question from everything else here: money in and money back,
    // computed from the orders themselves, with no dependence on visitor
    // tracking. If collection ever breaks, these figures stay true.
    label: 'Sales',
    href: '/analytics/sales',
    match: (p) => p.startsWith('/analytics/sales'),
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
  {
    // Not a traffic report — the capacity one. Every other tab answers "what did
    // people do"; this answers "how much more of it can we take", which is the
    // question nobody can answer until the day it matters.
    label: 'DevOps',
    href: '/analytics/devops',
    match: (p) => p.startsWith('/analytics/devops'),
  },
];

/**
 * Display order, left to right — not the match order.
 *
 * Grouped rather than flat. Ten equal-weight tabs in one row asked the operator
 * to remember which of them answers their question; the labels alone do not
 * say that Pages and Products are two halves of "what did people look at",
 * or that Sales and Checkout are two halves of "did they buy". Grouping puts
 * that structure on screen instead of in the operator's head.
 *
 * The groups are questions, not features:
 *   (ungrouped) Overview, Realtime — where you land, and what is happening now
 *   Audience    who they are and where they came from
 *   Behaviour   what they looked at and did
 *   Revenue     whether it turned into money
 *   System      whether the machine can take more
 *
 * Every href is unchanged. Regrouping is presentation only — no route moves,
 * so no rewrite entry changes and no existing link breaks.
 */
const GROUPS: { label: string | null; tabs: string[] }[] = [
  { label: null, tabs: ['Overview', 'Realtime'] },
  { label: 'Audience', tabs: ['Visitors', 'Acquisition'] },
  { label: 'Behaviour', tabs: ['Pages', 'Products', 'Events'] },
  { label: 'Revenue', tabs: ['Sales', 'Checkout'] },
  { label: 'System', tabs: ['DevOps'] },
];

const ORDER = GROUPS.flatMap((g) => g.tabs);

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

  return (
    <nav
      className="dash-catalog-subnav"
      aria-label="Analytics sections"
      data-trace-id="PG-DASHBOARD-ANL-000::EL-NAV-analytics-subnav"
      style={{ flexWrap: 'wrap', rowGap: 4 }}
    >
      {GROUPS.map((group, groupIndex) => (
        <React.Fragment key={group.label ?? `group-${groupIndex}`}>
          {/* A hairline rule, not a bullet or a slash — the separator should be
              felt as structure and not read as a character in the label list. */}
          {groupIndex > 0 ? (
            <span
              aria-hidden="true"
              style={{
                alignSelf: 'stretch',
                width: 1,
                margin: '0 10px',
                background: 'var(--mr-line-2, rgba(0,0,0,0.09))',
              }}
            />
          ) : null}

          {group.label ? (
            <span
              style={{
                alignSelf: 'center',
                marginRight: 8,
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--mr-fg-4)',
                // Not focusable and not a link: it names the group for a sighted
                // operator scanning the row. Screen readers get the same
                // grouping from the real list semantics below.
                userSelect: 'none',
              }}
            >
              {group.label}
            </span>
          ) : null}

          {group.tabs.map((label) => {
            const tab = TABS.find((t) => t.label === label)!;
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
        </React.Fragment>
      ))}
    </nav>
  );
}
