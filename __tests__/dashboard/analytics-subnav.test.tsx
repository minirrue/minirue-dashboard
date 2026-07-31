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

  it('offers all nine tabs in a stable order', () => {
    expect(ANALYTICS_TAB_LABELS).toEqual([
      'Overview',
      'Sales',
      'Realtime',
      'Visitors',
      'Pages',
      'Products',
      'Acquisition',
      'Checkout',
      'Events',
    ]);
  });
});
