import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StockOverviewClient from '@/app/dashboard/inventory/StockOverviewClient';
import * as inventoryApi from '@/lib/inventory/api';

jest.mock('@/lib/inventory/api', () => ({
  adjustStock: jest.fn(),
  listAllStockAdmin: jest.fn(),
  listInventoryCatalog: jest.fn(),
  listMovements: jest.fn(),
  setVariantStock: jest.fn(),
  stockStatus: (row: { qtyAvailable: number; isBelowThreshold: boolean }) =>
    row.qtyAvailable <= 0 ? 'OUT' : row.isBelowThreshold ? 'LOW' : 'OK',
}));

jest.mock('@/lib/hooks/use-clear-nav-badge', () => ({ useClearNavBadge: jest.fn() }));
jest.mock('@/components/dashboard/UploadPreviewImage', () => function ImageStub(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" {...props} />;
});

const api = inventoryApi as jest.Mocked<typeof inventoryApi>;

const stock = [
  { id: 's1', variantId: 'v1', warehouseId: 'w1', warehouseName: 'Main', warehouseLocationCode: 'MAIN', qtyOnHand: 12, qtyReserved: 2, qtyAvailable: 10, qtyThreshold: 3, isBelowThreshold: false },
  { id: 's2', variantId: 'v2', warehouseId: 'w1', warehouseName: 'Main', warehouseLocationCode: 'MAIN', qtyOnHand: 7, qtyReserved: 2, qtyAvailable: 5, qtyThreshold: 3, isBelowThreshold: false },
  { id: 's3', variantId: 'v3', warehouseId: 'w1', warehouseName: 'Main', warehouseLocationCode: 'MAIN', qtyOnHand: 2, qtyReserved: 1, qtyAvailable: 1, qtyThreshold: 3, isBelowThreshold: true },
];

const catalog = [{
  id: 'p1',
  name: 'Black Opium',
  brandId: 'b1',
  brandName: 'YSL',
  categoryId: 'c1',
  categoryName: 'Perfume',
  coverUrl: null,
  variants: [
    { id: 'v1', sku: 'BO-50', label: '50 ml' },
    { id: 'v2', sku: 'BO-90', label: '90 ml' },
    { id: 'v3', sku: 'BO-150', label: '150 ml' },
  ],
}];

describe('inventory editing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.listAllStockAdmin.mockResolvedValue(stock);
    api.listInventoryCatalog.mockResolvedValue(catalog);
    api.listMovements.mockResolvedValue({ data: [], total: 0 });
    api.adjustStock.mockImplementation(async ({ variantId }) => stock.find((row) => row.variantId === variantId)!);
    api.setVariantStock.mockResolvedValue({ variantId: 'v1', available: 1 });
  });

  it('saves an inline absolute value as an audited delta when Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<StockOverviewClient />);

    const quantity = (await screen.findAllByLabelText('Available stock for Black Opium 50 ml'))[0];
    await user.clear(quantity);
    await user.type(quantity, '14{Enter}');

    await waitFor(() => expect(api.adjustStock).toHaveBeenCalledWith({
      variantId: 'v1',
      warehouseId: 'w1',
      qty: 4,
      reason: 'Stock count',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Black Opium · 50 ml saved.');
  });

  it('bulk-sets three selected variants with one auditable adjustment per item', async () => {
    const user = userEvent.setup();
    render(<StockOverviewClient />);
    await screen.findAllByText('Black Opium');

    for (const label of ['Select Black Opium 50 ml', 'Select Black Opium 90 ml', 'Select Black Opium 150 ml']) {
      await user.click(screen.getAllByLabelText(label)[0]);
    }

    const toolbar = screen.getByRole('region', { name: 'Bulk stock actions' });
    await user.type(within(toolbar).getByLabelText('Bulk quantity'), '20');
    await user.click(within(toolbar).getByRole('button', { name: 'Apply to 3' }));

    await waitFor(() => expect(api.adjustStock).toHaveBeenCalledTimes(3));
    expect(api.adjustStock).toHaveBeenNthCalledWith(1, expect.objectContaining({ variantId: 'v1', qty: 10, reason: 'Stock count' }));
    expect(api.adjustStock).toHaveBeenNthCalledWith(2, expect.objectContaining({ variantId: 'v2', qty: 15, reason: 'Stock count' }));
    expect(api.adjustStock).toHaveBeenNthCalledWith(3, expect.objectContaining({ variantId: 'v3', qty: 19, reason: 'Stock count' }));
    expect(await screen.findByRole('status')).toHaveTextContent('3 variants updated.');
  });
});
