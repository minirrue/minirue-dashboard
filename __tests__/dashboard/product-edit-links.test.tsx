/**
 * #100: the product edit page header offers direct contextual links to this
 * exact product's Inventory row and (house products only) its Accounting
 * price row, styled like the existing Back ghost link and placed before the
 * destructive actions.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import EditProductPage from '@/app/dashboard/products/[slug]/edit/page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'prod-1' }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/app/dashboard/products/[slug]/edit/VariantsSection', () => ({
  __esModule: true,
  default: () => <div data-testid="variants-section" />,
}));

jest.mock('@/app/dashboard/products/[slug]/edit/MediaSection', () => ({
  __esModule: true,
  default: () => <div data-testid="media-section" />,
}));

jest.mock('@/components/dashboard/ProductClassification', () => ({
  __esModule: true,
  default: () => <div data-testid="classification" />,
}));

jest.mock('@/components/dashboard/ProductWarningsBadge', () => ({
  __esModule: true,
  default: () => <span data-testid="warnings-badge" />,
}));

const baseProduct = {
  id: 'prod-1',
  slug: 'nuit-santal',
  name: 'Nuit Santal',
  brandId: 'brand-1',
  brandName: 'Faces',
  description: 'A description',
  status: 'DRAFT',
  basePrice: 0,
  categoryId: 'cat-1',
  categoryName: 'Perfumes',
  variants: [],
  media: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const mockGetProduct = jest.fn();

jest.mock('@/lib/catalog/api', () => ({
  getProduct: (...args: unknown[]) => mockGetProduct(...args),
  updateProduct: jest.fn(),
  publishProduct: jest.fn(),
  archiveProduct: jest.fn(),
  softDeleteProduct: jest.fn(),
  hardDeleteProduct: jest.fn(),
  cloudinaryPreviewUrl: jest.fn(),
}));

describe('EditProductPage — contextual Inventory / Accounting links (#100)', () => {
  beforeEach(() => {
    mockGetProduct.mockReset();
  });

  it('links Inventory to this product’s name, and shows Accounting for a house product', async () => {
    mockGetProduct.mockResolvedValue({ ...baseProduct, isMinirueOwned: true });
    render(<EditProductPage />);

    const inventoryLink = await screen.findByRole('link', { name: 'Inventory' });
    expect(inventoryLink).toHaveAttribute('href', '/inventory?q=Nuit%20Santal');
    expect(inventoryLink).toHaveClass('dash-btn-ghost');

    const accountingLink = screen.getByRole('link', { name: 'Accounting' });
    expect(accountingLink).toHaveAttribute('href', '/accounting?tab=prices&q=Nuit%20Santal');
    expect(accountingLink).toHaveClass('dash-btn-ghost');
  });

  it('hides the Accounting link for a non-house (marketplace) product', async () => {
    mockGetProduct.mockResolvedValue({ ...baseProduct, isMinirueOwned: false });
    render(<EditProductPage />);

    await screen.findByRole('link', { name: 'Inventory' });
    expect(screen.queryByRole('link', { name: 'Accounting' })).not.toBeInTheDocument();
  });
});
