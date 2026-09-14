import { render, screen, cleanup } from '@testing-library/react';

/**
 * DA-5b (minirue-dashboard#61). The product edit page shows a yellow badge with
 * the product's own warnings count (`byProduct`, the same hook as the topbar),
 * linking to the Warnings tab filtered to that product.
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useParams: () => ({ slug: 'p1' }),
}));
jest.mock('@/lib/hooks/use-pricing-warnings', () => ({ usePricingWarnings: jest.fn() }));
jest.mock('@/lib/catalog/api', () => ({
  getProduct: jest.fn(),
  cloudinaryPreviewUrl: (id: string) => id,
}));
jest.mock('@/components/dashboard/ProductClassification', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/dashboard/products/[slug]/edit/VariantsSection', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/dashboard/products/[slug]/edit/MediaSection', () => ({ __esModule: true, default: () => null }));

import { usePricingWarnings } from '@/lib/hooks/use-pricing-warnings';
import { getProduct } from '@/lib/catalog/api';
import EditProductPage from '@/app/dashboard/products/[slug]/edit/page';
import ProductWarningsBadge from '@/components/dashboard/ProductWarningsBadge';

const mockWarnings = usePricingWarnings as jest.Mock;

function withByProduct(byProduct: Record<string, number>, total: number) {
  mockWarnings.mockReturnValue({ total, byProduct, items: [], isLoading: false, isError: false, recheck: jest.fn() });
}

beforeEach(() => {
  (getProduct as jest.Mock).mockResolvedValue({
    id: 'p1',
    name: 'REVOX PLEX',
    description: '',
    status: 'PUBLISHED',
    categoryId: 'c1',
    brandId: 'b1',
    variants: [],
    media: [],
  });
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('product page warnings badge', () => {
  it('shows this product’s count and links to the Warnings tab filtered to it', async () => {
    withByProduct({ p1: 2, p2: 1 }, 4);
    render(<EditProductPage />);

    const badge = await screen.findByRole('link', { name: '2 pricing warnings on this product' });
    expect(badge).toHaveAttribute('href', '/accounting?tab=warnings&product=p1');
    expect(badge).toHaveTextContent('2');
    expect(badge).toHaveClass('dash-product-warn');
  });

  it('renders nothing when the product has no warnings', () => {
    withByProduct({ p2: 1 }, 1);
    render(<ProductWarningsBadge productId="p1" />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('says "1 pricing warning" in the singular', () => {
    withByProduct({ p1: 1 }, 1);
    render(<ProductWarningsBadge productId="p1" />);
    expect(screen.getByRole('link', { name: '1 pricing warning on this product' })).toBeInTheDocument();
  });
});
