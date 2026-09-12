import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BundleMembersEditor from '@/app/dashboard/bundles/BundleMembersEditor';
import type { ProductListItem } from '@/lib/catalog/types';
import type { DraftMember } from '@/app/dashboard/bundles/bundle-economics';

/**
 * The picker used to render the catalogue by default.
 *
 * "What is inside (0/6)" listed twenty products under an empty search box, so
 * the tallest thing on a New bundle page was a list of everything that was NOT
 * in the bundle — and it got worse, not better, as the shop grew. The search
 * field already existed; the list is its result now.
 *
 * These tests hold that line, plus the two things the old picker could not say:
 * what the cap is before you hit it, and which variant a line means.
 */

function product(over: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: 'p1',
    slug: 'shampoo',
    name: 'Collagen Shampoo',
    brandId: 'b1',
    brandName: 'Karseell',
    brandImageUrl: null,
    coverUrl: null,
    status: 'PUBLISHED',
    sku: 'SKU-1',
    variantCount: 1,
    basePrice: 800,
    priceMin: 800,
    priceMax: 800,
    currency: 'EGP',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const PRODUCTS = [
  product(),
  product({ id: 'p2', name: 'Deep-Restoring Conditioner', sku: 'SKU-2' }),
  product({
    id: 'p3',
    name: 'Signature Eau de Parfum',
    brandName: 'MiniRue',
    sku: 'SKU-3',
    variantCount: 2,
    priceMin: 900,
    priceMax: 1500,
    basePrice: 900,
  }),
];

function renderEditor(over: Partial<React.ComponentProps<typeof BundleMembersEditor>> = {}) {
  const onChange = jest.fn();
  render(
    <BundleMembersEditor
      products={PRODUCTS}
      members={[]}
      onChange={onChange}
      variantsByProduct={{}}
      onNeedVariants={jest.fn()}
      unitMinorFor={() => 80000}
      currency="EGP"
      loading={false}
      duplicateIndex={-1}
      {...over}
    />,
  );
  return onChange;
}

describe('the picker is search-first', () => {
  it('shows no catalogue rows until something is typed', () => {
    renderEditor();

    expect(screen.getByLabelText(/add from your catalogue/i)).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.queryByText('Collagen Shampoo')).not.toBeInTheDocument();
  });

  it('shows matches as the result of a search', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(screen.getByLabelText(/add from your catalogue/i), 'condition');

    expect(screen.getByText('Deep-Restoring Conditioner')).toBeInTheDocument();
    expect(screen.queryByText('Collagen Shampoo')).not.toBeInTheDocument();
  });

  it('matches on brand and on SKU, not only on product name', () => {
    // An admin who knows the SKU should not have to remember the product name.
    renderEditor();

    expect(screen.getByLabelText(/add from your catalogue/i)).toHaveAttribute(
      'placeholder',
      expect.stringMatching(/SKU/i),
    );
  });

  it('still lets the whole catalogue be browsed, deliberately', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: /browse them all/i }));

    expect(screen.getByText('Collagen Shampoo')).toBeInTheDocument();
    expect(screen.getByText('Signature Eau de Parfum')).toBeInTheDocument();
  });

  it('adds the product that was clicked, at one unit and no pinned variant', async () => {
    const user = userEvent.setup();
    const onChange = renderEditor();

    await user.type(screen.getByLabelText(/add from your catalogue/i), 'collagen');
    await user.click(screen.getByText('Collagen Shampoo'));

    expect(onChange).toHaveBeenCalledWith([
      { productId: 'p1', variantId: null, quantity: 1 },
    ]);
  });
});

describe('the cap is stated, not sprung', () => {
  it('says the limit before the first line is added', () => {
    renderEditor();

    expect(screen.getByText(/holds 1 to 6 lines/i)).toBeInTheDocument();
    expect(screen.getByText('0 / 6')).toBeInTheDocument();
  });

  it('explains what to do instead once the set is full', () => {
    const members: DraftMember[] = Array.from({ length: 6 }, (_, i) => ({
      productId: `p${i}`,
      variantId: null,
      quantity: 1,
    }));
    renderEditor({ members });

    expect(screen.getByText(/at its limit of 6 lines/i)).toBeInTheDocument();
    // And the search box is gone rather than silently doing nothing.
    expect(
      screen.queryByLabelText(/add from your catalogue/i),
    ).not.toBeInTheDocument();
  });
});

describe('the chosen lines are visible and editable', () => {
  const members: DraftMember[] = [
    { productId: 'p1', variantId: null, quantity: 2 },
    { productId: 'p2', variantId: null, quantity: 1 },
  ];

  it('lists what has been picked, with its units per set', () => {
    renderEditor({ members });

    expect(screen.getByText('Collagen Shampoo')).toBeInTheDocument();
    expect(screen.getByText('Deep-Restoring Conditioner')).toBeInTheDocument();
    const qty = screen.getAllByLabelText(/units per set/i);
    expect(qty).toHaveLength(2);
    expect(qty[0]).toHaveValue(2);
  });

  it('shows what each line costs and what it contributes', () => {
    renderEditor({ members, unitMinorFor: () => 80000 });

    // 2 x 800.00 = 1,600.00 on the first line.
    expect(screen.getByText('EGP 1,600.00')).toBeInTheDocument();
  });

  it('reorders a line without losing the rest', async () => {
    const user = userEvent.setup();
    const onChange = renderEditor({ members });

    await user.click(
      screen.getByRole('button', { name: /move deep-restoring conditioner up/i }),
    );

    expect(onChange).toHaveBeenCalledWith([members[1], members[0]]);
  });

  it('removes the line that was asked for', async () => {
    const user = userEvent.setup();
    const onChange = renderEditor({ members });

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(onChange).toHaveBeenCalledWith([members[1]]);
  });
});

describe('a line can name a variant', () => {
  it('offers a choice only where there is one to make', () => {
    // The backend has taken a per-member variantId all along; sending none is
    // not "no opinion", it resolves to the product's CHEAPEST variant. A shop
    // selling 100 ML and 50 ML could not express a set of the 100 ML.
    renderEditor({
      members: [{ productId: 'p3', variantId: null, quantity: 1 }],
      variantsByProduct: {
        p3: [
          {
            id: 'v-100',
            productId: 'p3',
            sku: 'S-100',
            size: null,
            sizeMl: null,
            values: [
              {
                attributeId: 'a1',
                attributeName: 'Size',
                optionId: 'o1',
                optionName: '100 ML',
              },
            ],
            price: 1500,
            priceAmount: 1500,
            currency: 'EGP',
            stock: 4,
            isActive: true,
          },
        ],
      },
    });

    const select = screen.getByLabelText(/variant/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /cheapest/i })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /100 ML — EGP 1500.00/i }),
    ).toBeInTheDocument();
  });

  it('says so plainly when a product has only one variant', () => {
    renderEditor({ members: [{ productId: 'p1', variantId: null, quantity: 1 }] });

    expect(screen.queryByRole('combobox', { name: /variant/i })).not.toBeInTheDocument();
    expect(screen.getByText('Only one')).toBeInTheDocument();
  });
});
