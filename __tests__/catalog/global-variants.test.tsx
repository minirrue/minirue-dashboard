import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalVariantsPage from '@/app/dashboard/products/global-variants/page';
import * as api from '@/lib/catalog/api';

// Global variants — a brand's reusable variants.
// specs/2026-07-22-product-tree-design.md
jest.mock('@/lib/catalog/api');

const mockedApi = api as jest.Mocked<typeof api>;

const BRAND = { id: 'brand-1', name: 'Creed', createdAt: '2026-07-22' };

const ACTIVE = {
  id: 'gv-1',
  brandId: 'brand-1',
  label: '50ml',
  sizeMl: 50,
  defaultPriceAmount: '1500.0000',
  sortOrder: 0,
  isActive: true,
};
const DELETED = {
  id: 'gv-2',
  brandId: 'brand-1',
  label: '100ml',
  sizeMl: 100,
  defaultPriceAmount: null,
  sortOrder: 1,
  isActive: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.listManagedBrands.mockResolvedValue([BRAND]);
  mockedApi.listBrandGlobalVariants.mockResolvedValue([ACTIVE, DELETED]);
});

describe('GlobalVariantsPage', () => {
  it("lists the selected brand's variants", async () => {
    render(<GlobalVariantsPage />);

    expect(await screen.findByText('50ml')).toBeInTheDocument();
    expect(screen.getByText('100ml')).toBeInTheDocument();
  });

  it('shows size and default price beside the label', async () => {
    render(<GlobalVariantsPage />);

    await screen.findByText('50ml');
    expect(screen.getByText(/50 ml/)).toBeInTheDocument();
    expect(screen.getByText(/1500\.0000/)).toBeInTheDocument();
  });

  it('marks a deleted variant and offers Restore rather than Retire', async () => {
    render(<GlobalVariantsPage />);

    await screen.findByText('100ml');
    expect(screen.getByText(/— deleted/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /retire/i }),
    ).not.toBeInTheDocument();
  });

  it('adds a variant for the selected brand', async () => {
    mockedApi.createBrandGlobalVariant.mockResolvedValue({
      id: 'gv-3',
      brandId: 'brand-1',
      label: '30ml',
      sizeMl: 30,
      defaultPriceAmount: null,
      sortOrder: 0,
      isActive: true,
    });
    render(<GlobalVariantsPage />);
    await screen.findByText('50ml');

    fireEvent.change(screen.getByPlaceholderText(/label, e\.g\. 50ml/i), {
      target: { value: '30ml' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(await screen.findByText('30ml')).toBeInTheDocument();
    expect(mockedApi.createBrandGlobalVariant).toHaveBeenCalledWith(
      'brand-1',
      expect.objectContaining({ label: '30ml' }),
    );
  });

  it('surfaces the duplicate-label error from the API', async () => {
    mockedApi.createBrandGlobalVariant.mockRejectedValue({
      status: 400,
      message: "'50ml' already exists for Creed",
    });
    render(<GlobalVariantsPage />);
    await screen.findByText('50ml');

    fireEvent.change(screen.getByPlaceholderText(/label, e\.g\. 50ml/i), {
      target: { value: '50ml' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('offers both soft and hard delete rather than a single Delete', async () => {
    render(<GlobalVariantsPage />);
    await screen.findByText('50ml');

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    // DeleteChoiceDialog is the same component the product list uses, so the
    // admin gets the identical two choices everywhere — never one ambiguous
    // Delete, and never the invented word "Retire".
    expect(
      await screen.findByRole('button', { name: /soft delete/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /hard delete/i }),
    ).toBeInTheDocument();
  });

  it('tells the admin where to go when no brands exist', async () => {
    mockedApi.listManagedBrands.mockResolvedValue([]);
    render(<GlobalVariantsPage />);

    expect(await screen.findByText(/no brands yet/i)).toBeInTheDocument();
  });
});
