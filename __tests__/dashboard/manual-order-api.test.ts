import { apiAdminCreateManualOrder } from '@/lib/api/orders';

jest.mock('@/lib/api/client', () => ({
  apiFetch: jest.fn().mockResolvedValue({ id: 'o1', channel: 'MANUAL' }),
}));

import { apiFetch } from '@/lib/api/client';

describe('apiAdminCreateManualOrder', () => {
  it('POSTs the manual order to the admin endpoint', async () => {
    await apiAdminCreateManualOrder({
      guest: { fullName: 'Nour Hassan', phone: '01001234567' },
      items: [{ variantId: 'v1', qty: 2 }],
      paymentMethod: 'INSTAPAY',
      markPaid: true,
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/orders/admin/manual',
      expect.objectContaining({ method: 'POST', auth: true }),
    );
    const body = JSON.parse((apiFetch as jest.Mock).mock.calls[0][1].body);
    expect(body.guest.fullName).toBe('Nour Hassan');
    expect(body.items).toHaveLength(1);
  });
});
