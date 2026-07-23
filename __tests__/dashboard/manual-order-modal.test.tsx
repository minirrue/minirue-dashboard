import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ManualOrderModal, {
  sumLinesMinor,
  poundsToMinor,
} from '@/app/dashboard/orders/ManualOrderModal';
import * as catalogApi from '@/lib/catalog/api';
import type { Product, ProductListItem } from '@/lib/catalog/types';

// Manual factories (not bare `jest.mock('@/lib/catalog/api')`) so Jest never has to
// transform the real modules — lib/catalog/* has unrelated, unfinished edits from another
// session mid-refactor that currently fail to parse.
jest.mock('@/lib/catalog/api', () => ({
  listProducts: jest.fn(),
  getProduct: jest.fn(),
}));
jest.mock('@/lib/api/orders', () => ({
  apiAdminCreateManualOrder: jest.fn(),
}));

const mockedCatalog = catalogApi as jest.Mocked<typeof catalogApi>;

describe('sumLinesMinor', () => {
  it('multiplies unit price by quantity across lines', () => {
    expect(
      sumLinesMinor([
        { unitPriceMinor: 12500, qty: 2 },
        { unitPriceMinor: 4000, qty: 1 },
      ]),
    ).toBe(29000);
  });

  it('is zero for an empty basket', () => {
    expect(sumLinesMinor([])).toBe(0);
  });
});

describe('poundsToMinor', () => {
  it('converts pounds typed by the admin to integer piastres', () => {
    expect(poundsToMinor('125.00')).toBe(12500);
    expect(poundsToMinor('0')).toBe(0);
  });

  it('returns null for input that is not a usable non-negative number', () => {
    expect(poundsToMinor('')).toBeNull();
    expect(poundsToMinor('-')).toBeNull();
    expect(poundsToMinor('abc')).toBeNull();
    expect(poundsToMinor('-5')).toBeNull();
  });

  it('still returns null for empty/negative/non-numeric input after the display-fix', () => {
    // Regression guard: the fix must not weaken poundsToMinor itself — only
    // stop callers from dropping the admin's raw keystrokes on null.
    expect(poundsToMinor('   ')).toBeNull();
    expect(poundsToMinor('-1.5')).toBeNull();
    expect(poundsToMinor('12x')).toBeNull();
  });
});

const PRODUCT_LIST_ITEM: ProductListItem = {
  id: 'prod_1',
  slug: 'test-product',
  name: 'Test Product',
  brandId: 'brand_1',
  brandName: 'Test Brand',
  status: 'PUBLISHED',
  variantCount: 1,
  basePrice: 125,
  priceMin: 125,
  priceMax: 125,
  currency: 'EGP',
  createdAt: new Date().toISOString(),
};

const PRODUCT: Product = {
  id: 'prod_1',
  slug: 'test-product',
  name: 'Test Product',
  brandId: 'brand_1',
  brandName: 'Test Brand',
  description: '',
  status: 'PUBLISHED',
  basePrice: 125,
  categoryId: 'cat_1',
  categoryName: 'Category',
  media: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  variants: [
    {
      id: 'var_1',
      productId: 'prod_1',
      sku: 'SKU-1',
      size: null,
      sizeMl: null,
      values: [],
      price: 125,
      priceAmount: 125, // major units (EGP) -> 12500 minor
      currency: 'EGP',
      stock: 10,
    },
  ],
};

describe('ManualOrderModal — unit price display/value integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Renders through a portal; DashboardTable/etc. rely on matchMedia which jsdom lacks.
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

    mockedCatalog.listProducts.mockResolvedValue({
      items: [PRODUCT_LIST_ITEM],
      total: 1,
    });
    mockedCatalog.getProduct.mockResolvedValue(PRODUCT);
  });

  async function addLineToBasket() {
    render(<ManualOrderModal onClose={jest.fn()} onCreated={jest.fn()} />);

    const productSelect = await screen.findByLabelText('Product');
    // Options populate asynchronously from listProducts(); wait for the real one
    // to exist before selecting it, or the change event has nothing to select.
    await screen.findByText('Test Brand — Test Product');
    fireEvent.change(productSelect, { target: { value: 'prod_1' } });

    const variantSelect = await screen.findByLabelText('Variant');
    await waitFor(() => expect(variantSelect).not.toBeDisabled());
    fireEvent.change(variantSelect, { target: { value: 'var_1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add to order' }));

    return screen.findByDisplayValue('125.00');
  }

  it('keeps the field showing exactly what the admin typed, disables submit, and reformats on blur', async () => {
    const priceInput = await addLineToBasket();

    // Fill in the rest of the required fields so canSubmit would otherwise be true.
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByLabelText('Phone'), {
      target: { value: '01000000000' },
    });

    const submitButton = screen.getByRole('button', { name: 'Create order' });
    expect(submitButton).not.toBeDisabled();

    // Admin selects the field, deletes everything, types nothing more.
    fireEvent.change(priceInput, { target: { value: '' } });

    // The DOM must show exactly what was typed — empty — not snap back.
    expect((priceInput as HTMLInputElement).value).toBe('');
    // And submitting must be blocked while display and stored value could diverge.
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Enter a valid price')).toBeInTheDocument();

    // Losing focus restores the display to the last valid, formatted value.
    fireEvent.blur(priceInput);
    expect((priceInput as HTMLInputElement).value).toBe('125.00');
    expect(submitButton).not.toBeDisabled();
  });
});

describe('ManualOrderModal — receipt file type handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    mockedCatalog.listProducts.mockResolvedValue({ items: [], total: 0 });
  });

  function getReceiptInput() {
    return screen.getByLabelText('Receipt screenshot (optional)') as HTMLInputElement;
  }

  it('accepts a file reported as image/jpg', async () => {
    render(<ManualOrderModal onClose={jest.fn()} onCreated={jest.fn()} />);
    const input = getReceiptInput();
    const file = new File(['data'], 'receipt.jpg', { type: 'image/jpg' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('receipt.jpg')).toBeInTheDocument();
  });

  it('rejects a file that is not an allowed image type, with an inline error', async () => {
    render(<ManualOrderModal onClose={jest.fn()} onCreated={jest.fn()} />);
    const input = getReceiptInput();
    const file = new File(['data'], 'receipt.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText('Receipt must be a PNG or JPEG image'),
    ).toBeInTheDocument();
  });
});
