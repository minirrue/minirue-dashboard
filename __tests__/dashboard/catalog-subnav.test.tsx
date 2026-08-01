import { describe, expect, it } from '@jest/globals';
import {
  resolveActiveTab,
  CATALOG_TAB_LABELS,
  ALL_TAB_LABELS,
} from '@/components/dashboard/CatalogSubnav';

/**
 * The hallway's whole job is telling you which room you are in. The trap is
 * that /products/brands and /products/global-variants both start with
 * /products, so a naive check lights up "Products" on every catalogue screen.
 * These pin the active tab to the right one.
 */

describe('CatalogSubnav active tab', () => {
  const cases: Array<[string, string]> = [
    ['/catalogue', 'Products'],
    ['/catalogue/products', 'Products'],
    ['/catalogue/products/new', 'Products'],
    ['/catalogue/products/abc-123/edit', 'Products'],
    ['/catalogue/brands', 'Brands'],
    ['/catalogue/global-variants', 'Global variants'],
    ['/catalogue/categories', 'Categories'],
    // Tolerant of the app-router path with its /dashboard prefix.
    ['/dashboard/catalogue/brands', 'Brands'],
  ];

  it.each(cases)('marks %s as %s', (path, expected) => {
    expect(resolveActiveTab(path)).toBe(expected);
  });

  /**
   * Guards the trap that hid Bundles on 2026-08-01: a tab can be defined in
   * TABS, route correctly and build clean while never rendering, because the
   * bar renders from ORDER. Asserting the rendered list against every defined
   * tab is what makes that impossible to ship again.
   */
  it('renders every defined tab, in a stable order', () => {
    expect(CATALOG_TAB_LABELS).toEqual([
      'Products',
      'Categories',
      'Brands',
      'Global variants',
      'Bundles',
    ]);
  });

  it('leaves no tab defined but unrendered', () => {
    expect([...CATALOG_TAB_LABELS].sort()).toEqual([...ALL_TAB_LABELS].sort());
  });
});
