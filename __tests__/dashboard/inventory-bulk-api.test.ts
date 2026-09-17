import { apiFetch } from '@/lib/api/client';
import { bulkAdjustStock } from '@/lib/inventory/api';

jest.mock('@/lib/api/client', () => ({ apiFetch: jest.fn() }));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe('bulkAdjustStock', () => {
  it('sends the structured audit reason with an idempotency key', async () => {
    const randomUuid = jest.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-4234-8234-123456789abc');
    mockedApiFetch.mockResolvedValue({ updatedCount: 1 });

    await bulkAdjustStock({
      operation: 'SET',
      quantity: 7,
      reason: 'OTHER',
      reasonNote: 'Cycle count discrepancy',
      items: [{ variantId: '11111111-1111-4111-8111-111111111111' }],
    });

    expect(mockedApiFetch).toHaveBeenCalledWith('/inventory/stock/bulk', {
      method: 'POST',
      auth: true,
      headers: { 'Idempotency-Key': '12345678-1234-4234-8234-123456789abc' },
      body: JSON.stringify({
        operation: 'SET',
        quantity: 7,
        reason: 'OTHER',
        reasonNote: 'Cycle count discrepancy',
        items: [{ variantId: '11111111-1111-4111-8111-111111111111' }],
      }),
    });

    randomUuid.mockRestore();
  });
});
