import { describe, expect, it } from '@jest/globals';
import {
  ANALYTICS_GROUPS,
  ANALYTICS_TAB_LABELS,
  resolveActiveGroup,
  resolveActiveTab,
} from '@/components/dashboard/AnalyticsSubnav';

/**
 * Analytics & Media navigation (dashboard#90, #115). Owner, 2026-09-19:
 * Acquisition & Media and Behaviour merge into People & Journeys, so the tab
 * asks three questions. Every screen keeps its URL.
 */
describe('AnalyticsSubnav', () => {
  const cases: Array<[string, string, string]> = [
    ['/analytics', 'Overview', 'Overview'],
    ['/analytics/flow', 'Story Flow', 'People & Journeys'],
    ['/analytics/realtime', 'Realtime', 'People & Journeys'],
    ['/analytics/visitors', 'Visitors', 'People & Journeys'],
    ['/analytics/visitors/vis-abc-123', 'Visitors', 'People & Journeys'],
    ['/analytics/acquisition', 'Acquisition', 'People & Journeys'],
    ['/analytics/pages', 'Pages', 'People & Journeys'],
    ['/analytics/products/prod-abc-123', 'Products', 'People & Journeys'],
    ['/analytics/events', 'Events', 'People & Journeys'],
    ['/analytics/checkout', 'Checkout', 'People & Journeys'],
    ['/analytics/sales', 'Sales', 'People & Journeys'],
    ['/analytics/flags', 'Who counts', 'Health'],
    ['/analytics/devops', 'DevOps', 'Health'],
    // Tolerant of the app-router path with its /dashboard prefix.
    ['/dashboard/analytics/visitors', 'Visitors', 'People & Journeys'],
  ];

  it.each(cases)('%s → screen %s in group %s', (path, tab, group) => {
    expect(resolveActiveTab(path)).toBe(tab);
    expect(resolveActiveGroup(path)).toBe(group);
  });

  it('asks three questions, in order, and loses no screen', () => {
    expect(ANALYTICS_GROUPS.map((g) => g.label)).toEqual(['Overview', 'People & Journeys', 'Health']);
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

  it('groups People & Journeys by question, and every section screen is one of its tabs', () => {
    const pj = ANALYTICS_GROUPS.find((g) => g.label === 'People & Journeys')!;
    expect(pj.sections?.map((s) => s.label)).toEqual(['People', 'Came from', 'Did', 'Bought']);
    expect(pj.sections?.flatMap((s) => s.tabs)).toEqual(pj.tabs);
  });
});
