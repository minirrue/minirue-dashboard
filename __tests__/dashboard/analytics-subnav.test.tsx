import { describe, expect, it } from '@jest/globals';
import {
  resolveActiveTab,
  ANALYTICS_TAB_LABELS,
} from '@/components/dashboard/AnalyticsSubnav';

/**
 * Mirrors `catalog-subnav.test.tsx`: pins `resolveActiveTab` to the right
 * tab for every route Lane 6 scaffolds, the bare `/analytics` fallback, and
 * a `/dashboard`-prefixed variant.
 */

describe('AnalyticsSubnav active tab', () => {
  const cases: Array<[string, string]> = [
    ['/analytics', 'Overview'],
    ['/analytics/sales', 'Sales'],
    ['/analytics/realtime', 'Realtime'],
    ['/analytics/visitors', 'Visitors'],
    ['/analytics/visitors/vis-abc-123', 'Visitors'],
    ['/analytics/pages', 'Pages'],
    ['/analytics/products', 'Products'],
    ['/analytics/products/prod-abc-123', 'Products'],
    ['/analytics/acquisition', 'Acquisition'],
    ['/analytics/checkout', 'Checkout'],
    ['/analytics/events', 'Events'],
    // Tolerant of the app-router path with its /dashboard prefix.
    ['/dashboard/analytics/visitors', 'Visitors'],
  ];

  it.each(cases)('marks %s as %s', (path, expected) => {
    expect(resolveActiveTab(path)).toBe(expected);
  });

  /**
   * The order is grouped now, not flat: landing/live first, then the three
   * question-groups (Audience, Behaviour, Revenue), then System. Pinning it
   * here means a regrouping is a deliberate edit rather than something that
   * drifts when a tab is added.
   */
  it('offers all ten tabs in grouped order', () => {
    expect(ANALYTICS_TAB_LABELS).toEqual([
      // Where you land, and what is happening right now.
      'Overview',
      'Realtime',
      // Audience — who they are, where they came from.
      'Visitors',
      'Acquisition',
      // Behaviour — what they looked at and did.
      'Pages',
      'Products',
      'Events',
      // Revenue — whether it turned into money.
      'Sales',
      'Checkout',
      // System — whether the machine can take more.
      'DevOps',
    ]);
  });

  it('resolves the capacity screen', () => {
    expect(resolveActiveTab('/analytics/devops')).toBe('DevOps');
  });
});
