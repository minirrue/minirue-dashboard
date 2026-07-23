import { describe, expect, it } from '@jest/globals';
import {
  resolveActiveTab,
  CATALOG_TAB_LABELS,
} from '@/components/dashboard/CatalogSubnav';

/**
 * The hallway's whole job is telling you which room you are in. The trap is
 * that /products/brands and /products/global-variants both start with
 * /products, so a naive check lights up "Products" on every catalogue screen.
 * These pin the active tab to the right one.
 */

describe('CatalogSubnav active tab', () => {
  const cases: Array<[string, string]> = [
    ['/catalogue', 'Overview'],
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

  it('offers all five tabs in a stable order', () => {
    expect(CATALOG_TAB_LABELS).toEqual([
      'Overview',
      'Products',
      'Categories',
      'Brands',
      'Global variants',
    ]);
  });
});
