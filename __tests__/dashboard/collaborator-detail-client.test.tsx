import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

/**
 * QC 2026-07-30 — defect 1: the Products/Brands tabs on
 * /collaborators/<id> sat on "Loading products…" / "Loading brands…"
 * forever whenever the request failed. The client already had a
 * `.catch()` — the real bug was the fetch effect's guard condition
 * (`items.length > 0 || itemsLoading`), which does not account for a
 * failed-but-empty result: on error it re-armed itself on every render
 * the failed request caused, producing an endless retry loop that pinned
 * the loading flag back to `true` almost immediately after every failure.
 * The error text WAS being set, just for an imperceptible instant before
 * the next retry started — which is exactly what reads as "hangs on
 * Loading… forever".
 *
 * These tests fail against the pre-fix code (the mock rejects every call,
 * so the effect kept re-firing and `listProducts`/`listManagedBrands`
 * would be called far more than once, and the error text would not still
 * be there after letting more time pass).
 */

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'collab-1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/app/dashboard/categories/CategoryTree', () => ({
  __esModule: true,
  default: () => <div data-testid="category-tree" />,
}));

jest.mock('@/lib/api/collaborators', () => ({
  apiGetCollaborator: jest.fn(),
  apiArchiveCollaborator: jest.fn(),
  apiGetCollaboratorDeleteImpact: jest.fn(),
  apiHardDeleteCollaborator: jest.fn(),
  apiReactivateCollaborator: jest.fn(),
  apiSoftDeleteCollaborator: jest.fn(),
  apiSuspendCollaborator: jest.fn(),
  apiUpdateCollaborator: jest.fn(),
  apiUpdateCollaboratorSettings: jest.fn(),
  apiGetCollaboratorActivity: jest.fn(),
}));

jest.mock('@/lib/catalog/api', () => ({
  listProducts: jest.fn(),
  listManagedBrands: jest.fn(),
  listCategories: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
}));

import CollaboratorDetailClient from '@/app/dashboard/collaborators/[id]/CollaboratorDetailClient';
import { apiGetCollaborator } from '@/lib/api/collaborators';
import { listProducts, listManagedBrands } from '@/lib/catalog/api';

const mockedGetCollaborator = apiGetCollaborator as jest.Mock;
const mockedListProducts = listProducts as jest.Mock;
const mockedListManagedBrands = listManagedBrands as jest.Mock;

const COLLAB = {
  id: 'collab-1',
  email: 'partner@helia.example',
  brandName: 'Helia',
  brandSlug: 'helia',
  status: 'ACTIVE' as const,
  modules: ['ORDERS', 'PRODUCTS'] as const,
  description: null,
  logoUrl: null,
  autoPublishProducts: false,
  storefrontHomeFeature: false,
  storefrontNavLink: false,
  storefrontVisible: true,
  commissionRate: '0.2000',
  fulfillmentMode: 'MINIRUE_SHIPS' as const,
};

async function renderOnTab(tab: 'Products' | 'Brands') {
  render(<CollaboratorDetailClient />);
  await screen.findByText('Helia');
  fireEvent.click(screen.getByRole('tab', { name: tab }));
}

describe('CollaboratorDetailClient — Products/Brands tabs never hang forever', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCollaborator.mockResolvedValue(COLLAB);
  });

  it('shows a real error instead of an eternal spinner when the products request fails', async () => {
    mockedListProducts.mockRejectedValue({ status: 500, message: 'Server error' });
    await renderOnTab('Products');

    expect(await screen.findByText('Server error')).toBeInTheDocument();
    expect(screen.queryByText(/Loading products/i)).not.toBeInTheDocument();

    // Give any stray retry loop a chance to fire again, then confirm the
    // error is still the only thing on screen and the call was not repeated.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByText('Server error')).toBeInTheDocument();
    expect(screen.queryByText(/Loading products/i)).not.toBeInTheDocument();
    expect(mockedListProducts).toHaveBeenCalledTimes(1);
  });

  it('shows a real error instead of an eternal spinner when the brands request fails', async () => {
    mockedListManagedBrands.mockRejectedValue({ status: 403, message: 'Insufficient role' });
    await renderOnTab('Brands');

    expect(await screen.findByText('Insufficient role')).toBeInTheDocument();
    expect(screen.queryByText(/Loading brands/i)).not.toBeInTheDocument();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByText('Insufficient role')).toBeInTheDocument();
    expect(mockedListManagedBrands).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state, not a spinner, when a partner has nothing listed yet', async () => {
    mockedListProducts.mockResolvedValue({ items: [], total: 0 });
    await renderOnTab('Products');

    expect(await screen.findByText('This partner has not listed anything yet.')).toBeInTheDocument();
  });
});

describe('CollaboratorDetailClient — brand page path (defect 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCollaborator.mockResolvedValue(COLLAB);
  });

  it('advertises the root-level storefront path, not a dead /brands/ URL', async () => {
    render(<CollaboratorDetailClient />);
    await screen.findByText('Helia');

    expect(screen.getByText('/helia')).toBeInTheDocument();
    expect(screen.queryByText('/brands/helia')).not.toBeInTheDocument();
  });
});
