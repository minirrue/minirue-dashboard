import { describe, expect, it } from '@jest/globals';
import {
  ANALYTICS_GROUPS,
  ANALYTICS_TAB_LABELS,
  resolveActiveGroup,
  resolveActiveTab,
} from '@/components/dashboard/AnalyticsSubnav';

/**
 * Analytics & Media navigation (dashboard#90, #115): five questions on top,
 * the screens inside the chosen one underneath. Every screen keeps its URL.
 */
describe('AnalyticsSubnav', () => {
  const cases: Array<[string, string, string]> = [
    ['/analytics', 'Overview', 'Overview'],
    ['/analytics/flow', 'Story Flow', 'People & Journeys'],
    ['/analytics/realtime', 'Realtime', 'People & Journeys'],
    ['/analytics/visitors', 'Visitors', 'People & Journeys'],
    ['/analytics/visitors/vis-abc-123', 'Visitors', 'People & Journeys'],
    ['/analytics/acquisition', 'Acquisition', 'Acquisition & Media'],
    ['/analytics/pages', 'Pages', 'Behaviour'],
    ['/analytics/products/prod-abc-123', 'Products', 'Behaviour'],
    ['/analytics/events', 'Events', 'Behaviour'],
    ['/analytics/checkout', 'Checkout', 'Behaviour'],
    ['/analytics/sales', 'Sales', 'Behaviour'],
    ['/analytics/flags', 'Who counts', 'Health'],
    ['/analytics/devops', 'DevOps', 'Health'],
    // Tolerant of the app-router path with its /dashboard prefix.
    ['/dashboard/analytics/visitors', 'Visitors', 'People & Journeys'],
  ];

  it.each(cases)('%s → screen %s in group %s', (path, tab, group) => {
    expect(resolveActiveTab(path)).toBe(tab);
    expect(resolveActiveGroup(path)).toBe(group);
  });

  it('asks five questions, in order, and loses no screen', () => {
    expect(ANALYTICS_GROUPS.map((g) => g.label)).toEqual([
      'Overview',
      'People & Journeys',
      'Acquisition & Media',
      'Behaviour',
      'Health',
    ]);
    expect(ANALYTICS_TAB_LABELS).toEqual([
      'Overview',
      'Story Flow',
      'Visitors',
      'Realtime',
      'Acquisition',
      'Pages',
      'Products',
      'Events',
      'Checkout',
      'Sales',
      'Who counts',
      'DevOps',
    ]);
  });
});
