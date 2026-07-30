import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ProductsClient from '@/app/dashboard/products/ProductsClient';
import * as catalogApi from '@/lib/catalog/api';
import type { ProductListItem } from '@/lib/catalog/types';

// Manual factories (not bare `jest.mock('@/lib/catalog/api')`), matching
// manual-order-modal.test.tsx's approach — lib/catalog/api.ts is large and
// under active concurrent edit, so a narrow factory keeps this test from
// depending on parts of it this test never touches.
jest.mock('@/lib/catalog/api', () => ({
  listProducts: jest.fn(),
  listManagedBrands: jest.fn(),
  publishProduct: jest.fn(),
  archiveProduct: jest.fn(),
  softDeleteProduct: jest.fn(),
  hardDeleteProduct: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/catalogue/products',
}));

const mockedCatalog = catalogApi as jest.Mocked<typeof catalogApi>;

function makeProduct(overrides: Partial<ProductListItem> & { id: string }): ProductListItem {
  return {
    id: overrides.id,
    slug: overrides.slug ?? overrides.id,
    name: overrides.name ?? 'Untitled',
    brandId: overrides.brandId ?? 'brand_1',
    brandName: overrides.brandName ?? '',
    status: overrides.status ?? 'PUBLISHED',
    variantCount: overrides.variantCount ?? 1,
    basePrice: overrides.basePrice ?? 100,
    priceMin: overrides.priceMin ?? 100,
    priceMax: overrides.priceMax ?? 100,
    currency: overrides.currency ?? 'EGP',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

function mockListProducts(items: ProductListItem[]) {
  mockedCatalog.listProducts.mockResolvedValue({ items, total: items.length });
}

describe('ProductsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCatalog.listManagedBrands.mockResolvedValue([]);
    // DashboardTable does mobile detection via matchMedia, which jsdom doesn't implement.
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  it('renders the brand name in the Brand column', async () => {
    mockListProducts([
      makeProduct({ id: '1', name: 'No.1', brandName: 'Billie Eillish', status: 'PUBLISHED' }),
    ]);
    render(<ProductsClient />);
    expect(await screen.findByText('Billie Eillish')).toBeInTheDocument();
  });

  it('asks for MiniRue products only', async () => {
    mockListProducts([]);
    render(<ProductsClient />);
    await waitFor(() =>
      expect(mockedCatalog.listProducts).toHaveBeenCalledWith(
        expect.objectContaining({ space: 'house' }),
      ),
    );
  });

  it('scopes the brand filter dropdown to MiniRue only', async () => {
    mockListProducts([]);
    render(<ProductsClient />);
    await waitFor(() =>
      expect(mockedCatalog.listManagedBrands).toHaveBeenCalledWith(
        expect.objectContaining({ space: 'house' }),
      ),
    );
  });

  it('labels a partner product awaiting review', async () => {
    mockListProducts([
      makeProduct({ id: '2', name: 'test', brandName: 'Generic', status: 'PENDING_REVIEW' }),
    ]);
    render(<ProductsClient />);
    expect(await screen.findByText('Waiting for review')).toBeInTheDocument();
  });

  it('labels a rejected product', async () => {
    mockListProducts([
      makeProduct({ id: '3', name: 'test', brandName: 'Generic', status: 'REJECTED' }),
    ]);
    render(<ProductsClient />);
    expect(await screen.findByText('Rejected')).toBeInTheDocument();
  });
});
