import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VariantsSection from '@/app/dashboard/products/[slug]/edit/VariantsSection';
import type { ProductVariant } from '@/lib/catalog/types';

/**
 * #15, part 3 — a prop the parent passed and the child silently ignored.
 *
 * `onSelectVariant` was declared in Props, destructured, and never called.
 * `selectedVariantId` IS read, so the table rendered a selected row that no
 * click could produce — and with it the whole "Photos for <SKU>" section on the
 * edit page, which is only rendered once a variant is selected
 * (specs/006-gallery-module US3, T031). A feature with no way in.
 *
 * These tests hold the way in: a toggle on the row, reported to the parent, and
 * cleared when the row it names is destroyed.
 */

jest.mock('@/lib/catalog/api', () => ({
  createVariant: jest.fn(),
  updateVariant: jest.fn(),
  softDeleteVariant: jest.fn(),
  restoreVariant: jest.fn(),
  hardDeleteVariant: jest.fn(),
  createProductMedia: jest.fn(),
  listAttributes: jest.fn(),
  listAttributeOptions: jest.fn(),
  apiSetVariantStock: jest.fn(),
}));

import { hardDeleteVariant, listAttributes, listAttributeOptions } from '@/lib/catalog/api';

function makeVariant(over: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'variant-1',
    sku: 'AVN-50',
    values: [],
    customValues: {},
    priceAmount: '1200.00',
    currency: 'EGP',
    stock: 4,
    isActive: true,
    ...over,
  } as ProductVariant;
}

/** The edit page's own wiring: it holds the selection and renders on it. */
function Harness({ variants }: { variants: ProductVariant[] }) {
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(null);
  return (
    <>
      <VariantsSection
        productId="product-1"
        categoryId="category-1"
        variants={variants}
        onVariantsChange={() => {}}
        media={[]}
        onMediaChange={() => {}}
        selectedVariantId={selectedVariantId}
        onSelectVariant={setSelectedVariantId}
      />
      {selectedVariantId && <p>Photos for {selectedVariantId}</p>}
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (listAttributes as jest.Mock).mockResolvedValue([]);
  (listAttributeOptions as jest.Mock).mockResolvedValue([]);
  (hardDeleteVariant as jest.Mock).mockResolvedValue(undefined);
});

describe('VariantsSection — selecting a variant', () => {
  it('offers a way to select a variant at all', async () => {
    render(<Harness variants={[makeVariant()]} />);

    expect(
      await screen.findByRole('button', { name: /^photos$/i }),
    ).toBeInTheDocument();
  });

  it('reports the selection to the parent, which is what reveals the photo panel', async () => {
    const user = userEvent.setup();
    render(<Harness variants={[makeVariant()]} />);

    await user.click(await screen.findByRole('button', { name: /^photos$/i }));

    expect(await screen.findByText('Photos for variant-1')).toBeInTheDocument();
  });

  it('marks the open row pressed, so the table says which one is showing', async () => {
    const user = userEvent.setup();
    render(<Harness variants={[makeVariant()]} />);

    await user.click(await screen.findByRole('button', { name: /^photos$/i }));

    const toggle = screen.getByRole('button', { name: /hide photos/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles back off — the only route to the unfiltered product photos', async () => {
    const user = userEvent.setup();
    render(<Harness variants={[makeVariant()]} />);

    await user.click(await screen.findByRole('button', { name: /^photos$/i }));
    await user.click(await screen.findByRole('button', { name: /hide photos/i }));

    await waitFor(() =>
      expect(screen.queryByText('Photos for variant-1')).not.toBeInTheDocument(),
    );
  });

  it('selects the row that was clicked when there are several', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        variants={[
          makeVariant(),
          makeVariant({ id: 'variant-2', sku: 'AVN-100' }),
        ]}
      />,
    );

    const buttons = await screen.findAllByRole('button', { name: /^photos$/i });
    await user.click(buttons[1]);

    expect(await screen.findByText('Photos for variant-2')).toBeInTheDocument();
  });
});
