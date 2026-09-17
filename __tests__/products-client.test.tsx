import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  listCategories: jest.fn(),
  publishProduct: jest.fn(),
  archiveProduct: jest.fn(),
  softDeleteProduct: jest.fn(),
  hardDeleteProduct: jest.fn(),
}));

jest.mock('@/lib/api/accounting', () => ({
  apiAccountingOverview: jest.fn(),
}));

import * as accountingApi from '@/lib/api/accounting';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/catalogue/products',
}));

const mockedCatalog = catalogApi as jest.Mocked<typeof catalogApi>;
const mockedAccounting = accountingApi as jest.Mocked<typeof accountingApi>;

function makeProduct(overrides: Partial<ProductListItem> & { id: string }): ProductListItem {
  return {
    id: overrides.id,
    slug: overrides.slug ?? overrides.id,
    name: overrides.name ?? 'Untitled',
    brandId: overrides.brandId ?? 'brand_1',
    brandName: overrides.brandName ?? '',
    categoryId: overrides.categoryId,
    brandImageUrl: overrides.brandImageUrl ?? null,
    coverUrl: overrides.coverUrl ?? null,
    sku: overrides.sku ?? '',
    status: overrides.status ?? 'PUBLISHED',
    variantCount: overrides.variantCount ?? 1,
    basePrice: overrides.basePrice ?? 100,
    priceMin: overrides.priceMin ?? 100,
    priceMax: overrides.priceMax ?? 100,
    currency: overrides.currency ?? 'EGP',
    stockAvailable: overrides.stockAvailable ?? 0,
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
    mockedCatalog.listCategories.mockResolvedValue({ items: [] });
    mockedAccounting.apiAccountingOverview.mockResolvedValue({ variants: [] } as never);
    window.history.replaceState({}, '', '/catalogue/products');
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

  it('shows live price mode and colour-coded available stock', async () => {
    mockListProducts([
      makeProduct({ id: 'system', name: 'System serum', priceMin: 450, stockAvailable: 2 }),
      makeProduct({ id: 'manual', name: 'Manual mist', priceMin: 300, stockAvailable: 0 }),
    ]);
    mockedAccounting.apiAccountingOverview.mockResolvedValue({
      variants: [
        { productId: 'system', mode: 'SYSTEM' },
        { productId: 'manual', mode: 'MANUAL' },
      ],
    } as never);

    render(<ProductsClient />);

    expect(await screen.findByText('System')).toBeInTheDocument();
    expect(screen.getByText('My price', { selector: '.dash-status' })).toBeInTheDocument();
    expect(screen.getByText('2')).toHaveAttribute('data-stock', 'low');
    expect(screen.getByText('0')).toHaveAttribute('data-stock', 'out');
  });

  it('filters stock and sorts by live price', async () => {
    mockListProducts([
      makeProduct({ id: 'high', name: 'Higher price', priceMin: 900, stockAvailable: 8 }),
      makeProduct({ id: 'low', name: 'Lower price', priceMin: 100, stockAvailable: 0 }),
    ]);
    render(<ProductsClient />);
    await screen.findByText('Higher price');

    fireEvent.click(screen.getByRole('columnheader', { name: /Price/ }));
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Lower price')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by stock'), { target: { value: 'OUT' } });
    expect(screen.queryByText('Higher price')).not.toBeInTheDocument();
    expect(screen.getByText('Lower price')).toBeInTheDocument();
  });

  it('switches between 20/50/100 rows and keeps the choice in the URL', async () => {
    mockListProducts(Array.from({ length: 25 }, (_, i) => makeProduct({
      id: `p-${i + 1}`,
      name: `Product ${i + 1}`,
    })));
    render(<ProductsClient />);

    expect(await screen.findByText(/1–20 of 25/)).toBeInTheDocument();
    expect(screen.queryByText('Product 25')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } });
    expect(await screen.findByText('Product 25')).toBeInTheDocument();
    expect(window.location.search).toContain('size=50');
  });
});
