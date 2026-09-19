'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Analytics & Media navigation (dashboard#90, #115): two tiers.
 *
 * The flat row of ten tabs wrapped onto two lines and asked the owner to
 * remember which screen answers which question. The top tier is now the five
 * questions the owner actually asks; the second tier shows only the screens
 * inside the chosen question.
 *
 *   Overview              — the summary
 *   People & Journeys     — the connected flow, every visitor, who is here now
 *   Acquisition & Media   — where they came from, which ads worked
 *   Behaviour             — what they looked at, what they bought
 *   Health                — can these numbers be trusted (who counts, capacity)
 *
 * Every href is unchanged — regrouping is presentation only, so no link or
 * rewrite breaks. The range and traffic scope in the URL travel with every
 * link, so switching screens keeps the question you were asking.
 */

interface Tab {
  label: string;
  href: string;
  match: (path: string) => boolean;
}

const TABS: Tab[] = [
  { label: 'Overview', href: '/analytics', match: (p) => p === '/analytics' || p === '/analytics/' },
  { label: 'Realtime', href: '/analytics/realtime', match: (p) => p.startsWith('/analytics/realtime') },
  // dashboard#123: every real shopper as one connected flow, down to the person
  // and why they didn't buy. Story Flow merged in here; /analytics/flow redirects.
  { label: 'Visitors', href: '/analytics/visitors', match: (p) => ['/analytics/visitors', '/analytics/flow', '/analytics/acquisition', '/analytics/checkout'].some((r) => p.startsWith(r)) },
  { label: 'Pages', href: '/analytics/pages', match: (p) => p.startsWith('/analytics/pages') },
  { label: 'Products', href: '/analytics/products', match: (p) => p.startsWith('/analytics/products') },
  { label: 'Events', href: '/analytics/events', match: (p) => p.startsWith('/analytics/events') },
  // Money in and back, computed from orders alone — true even if tracking breaks.
  { label: 'Sales', href: '/analytics/sales', match: (p) => p.startsWith('/analytics/sales') },
  // dashboard#111: every verdict on who counts.
  { label: 'Who counts', href: '/analytics/flags', match: (p) => p.startsWith('/analytics/flags') },
  // Capacity: how much more traffic the machine can take.
  { label: 'DevOps', href: '/analytics/devops', match: (p) => p.startsWith('/analytics/devops') },
];

export interface AnalyticsGroup {
  label: string;
  tabs: string[];
  /** Sub-groups inside the second row, by the question they answer. */
  sections?: { label: string; tabs: string[] }[];
}

/**
 * Owner, 2026-09-19: "merge Acquisition & Media and Behaviour into People &
 * Journeys" — one place where the people, where they came from and what they
 * did live together and link to each other.
 */
export const ANALYTICS_GROUPS: AnalyticsGroup[] = [
  { label: 'Overview', tabs: ['Overview'] },
  {
    label: 'People & Journeys',
    tabs: ['Visitors', 'Realtime', 'Pages', 'Products', 'Events', 'Sales'],
    sections: [
      { label: 'People', tabs: ['Visitors', 'Realtime'] },
      { label: 'Did', tabs: ['Pages', 'Products', 'Events'] },
      { label: 'Bought', tabs: ['Sales'] },
    ],
  },
  { label: 'Health', tabs: ['Who counts', 'DevOps'] },
];

/** Every screen, in display order. */
export const ANALYTICS_TAB_LABELS = ANALYTICS_GROUPS.flatMap((g) => g.tabs);

/** Which screen owns this path (pure, for tests). */
export function resolveActiveTab(path: string): string {
  const p = path.replace(/^\/dashboard(?=\/)/, '');
  return TABS.find((t) => t.match(p))?.label ?? 'Overview';
}

/** Which question-group owns this path. */
export function resolveActiveGroup(path: string): string {
  const tab = resolveActiveTab(path);
  return ANALYTICS_GROUPS.find((g) => g.tabs.includes(tab))?.label ?? 'Overview';
}

const tabByLabel = (label: string) => TABS.find((t) => t.label === label)!;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

type ScopeParams = { get(key: string): string | null };

/** Keep the range and traffic scope when moving between screens. */
function withScope(href: string, params: ScopeParams | null): string {
  if (!params) return href;
  const keep = new URLSearchParams();
  for (const key of ['from', 'to', 'compare', 'traffic']) {
    const v = params.get(key);
    if (v) keep.set(key, v);
  }
  const qs = keep.toString();
  return qs ? `${href}?${qs}` : href;
}

/**
 * `useSearchParams` needs a Suspense boundary on statically rendered pages; the
 * fallback is the same nav without carried-over scope, so nothing jumps.
 */
export default function AnalyticsSubnav() {
  return (
    <Suspense fallback={<SubnavView params={null} />}>
      <SubnavWithParams />
    </Suspense>
  );
}

function SubnavWithParams() {
  return <SubnavView params={useSearchParams()} />;
}

function SubnavView({ params }: { params: ScopeParams | null }) {
  const pathname = usePathname() ?? '/analytics';
  const currentTab = resolveActiveTab(pathname);
  const currentGroup = ANALYTICS_GROUPS.find((g) => g.tabs.includes(currentTab)) ?? ANALYTICS_GROUPS[0];

  return (
    <nav className="dash-analytics-nav" aria-label="Analytics sections" data-trace-id="PG-DASHBOARD-ANL-000::EL-NAV-analytics-subnav">
      <div className="dash-analytics-nav__groups" role="list">
        {ANALYTICS_GROUPS.map((group) => {
          const active = group.label === currentGroup.label;
          return (
            <Link
              key={group.label}
              role="listitem"
              href={withScope(tabByLabel(group.tabs[0]).href, params)}
              className="dash-analytics-nav__group"
              data-active={active || undefined}
              aria-current={active && group.tabs.length === 1 ? 'page' : undefined}
              data-trace-id={`PG-DASHBOARD-ANL-000::EL-LINK-group-${slug(group.label)}`}
            >
              {group.label}
            </Link>
          );
        })}
      </div>
      {currentGroup.tabs.length > 1 && (
        <div className="dash-analytics-nav__tabs" role="list" aria-label={currentGroup.label}>
          {(currentGroup.sections ?? [{ label: '', tabs: currentGroup.tabs }]).map((section, si) => (
            <div key={section.label || si} className="dash-analytics-nav__section" role="group" aria-label={section.label || undefined}>
              {section.label ? <span className="dash-analytics-nav__section-label">{section.label}</span> : null}
          {section.tabs.map((label) => {
            const tab = tabByLabel(label);
            const active = label === currentTab;
            return (
              <Link
                key={label}
                role="listitem"
                href={withScope(tab.href, params)}
                className="dash-analytics-nav__tab"
                data-active={active || undefined}
                aria-current={active ? 'page' : undefined}
                data-trace-id={`PG-DASHBOARD-ANL-000::EL-LINK-subnav-${slug(label)}`}
              >
                {label}
              </Link>
            );
          })}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
