import { formatNavCount, navUnreadCount } from '@/lib/notifications/nav-counts';

describe('navUnreadCount', () => {
  it('gives Support its own number, separate from Customers', () => {
    // The whole reason SUPPORT was split out of CUSTOMER: these two screens
    // must never report each other's unread messages.
    const counts = { SUPPORT: 3, CUSTOMER: 5 };
    expect(navUnreadCount('/support', counts)).toBe(3);
    expect(navUnreadCount('/customers', counts)).toBe(5);
  });

  it('sums every category a single screen owns', () => {
    // Orders and their payments are both read on the Orders screen.
    expect(navUnreadCount('/orders', { ORDER: 2, PAYMENT: 4 })).toBe(6);
  });

  it('counts categories the same way in the collaborator portal', () => {
    const counts = { SUPPORT: 1, ORDER: 2, PAYMENT: 1 };
    expect(navUnreadCount('/collab/support', counts)).toBe(1);
    expect(navUnreadCount('/collab/orders', counts)).toBe(3);
  });

  it('is 0 for a screen that owns no category, so no badge renders', () => {
    expect(navUnreadCount('/settings', { ORDER: 9 })).toBe(0);
    expect(navUnreadCount('/overview', { ORDER: 9 })).toBe(0);
  });

  it('leaves SYSTEM to the bell rather than pinning it to a tab', () => {
    // SYSTEM has no screen of its own; /notifications lists everything and the
    // bell above it already carries that total.
    expect(navUnreadCount('/notifications', { SYSTEM: 4 })).toBe(0);
  });

  it('treats a missing category as zero, not NaN', () => {
    // The API omits categories with no unread rows entirely.
    expect(navUnreadCount('/orders', {})).toBe(0);
    expect(navUnreadCount('/orders', { ORDER: 2 })).toBe(2);
  });
});

describe('formatNavCount', () => {
  it('caps at 99+ so the pill cannot deform', () => {
    expect(formatNavCount(1)).toBe('1');
    expect(formatNavCount(99)).toBe('99');
    expect(formatNavCount(100)).toBe('99+');
  });
});
