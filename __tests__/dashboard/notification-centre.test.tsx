import { describe, expect, it, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationDrawer from '@/components/dashboard/NotificationDrawer';
import type { AdminNotification } from '@/lib/api/notifications';

jest.mock('@/lib/api/notifications', () => ({
  NOTIFICATION_CATEGORIES: ['ORDER', 'PAYMENT', 'FULFILLMENT', 'REFUND', 'INVENTORY', 'CUSTOMER', 'COLLAB', 'SYSTEM'],
  NOTIFICATION_SEVERITIES: ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'],
  apiAdminListNotifications: jest.fn(),
  apiAdminMarkNotificationRead: jest.fn(),
  apiAdminMarkAllNotificationsRead: jest.fn(),
}));

import {
  apiAdminListNotifications,
  apiAdminMarkAllNotificationsRead,
} from '@/lib/api/notifications';

function n(over: Partial<AdminNotification> = {}): AdminNotification {
  return {
    id: 1,
    category: 'ORDER',
    severity: 'INFO',
    title: 'New order #47',
    body: 'Nadia placed an order for EGP 150.00.',
    entityType: 'order',
    entityId: 'uuid-1',
    actorName: 'Nadia',
    link: '/orders/uuid-1',
    isRead: false,
    data: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function result(items: AdminNotification[]) {
  return {
    data: items,
    total: items.length,
    unreadCount: items.filter((i) => !i.isRead).length,
    categoryCounts: { ORDER: 1 },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (apiAdminListNotifications as jest.Mock).mockResolvedValue(result([n()]));
});

describe('NotificationDrawer', () => {
  it('loads and shows real notifications instead of a hardcoded empty state', async () => {
    render(<NotificationDrawer open onClose={jest.fn()} />);
    expect(await screen.findByText('New order #47')).toBeInTheDocument();
  });

  it('has a refresh button that refetches from the database', async () => {
    render(<NotificationDrawer open onClose={jest.fn()} />);
    await screen.findByText('New order #47');
    (apiAdminListNotifications as jest.Mock).mockClear();

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(apiAdminListNotifications).toHaveBeenCalled());
  });

  it('sends the typed search term to the API', async () => {
    render(<NotificationDrawer open onClose={jest.fn()} />);
    await screen.findByText('New order #47');

    await userEvent.type(screen.getByLabelText(/search notifications/i), 'Nadia');

    await waitFor(
      () =>
        expect(apiAdminListNotifications).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'Nadia' }),
        ),
      { timeout: 2000 },
    );
  });

  it('filters by category when a chip is clicked', async () => {
    render(<NotificationDrawer open onClose={jest.fn()} />);
    await screen.findByText('New order #47');

    await userEvent.click(screen.getByRole('button', { name: /refund/i }));

    await waitFor(() =>
      expect(apiAdminListNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ categories: ['REFUND'] }),
      ),
    );
  });

  it('changes the sort order', async () => {
    render(<NotificationDrawer open onClose={jest.fn()} />);
    await screen.findByText('New order #47');

    await userEvent.selectOptions(screen.getByLabelText(/sort/i), 'oldest');

    await waitFor(() =>
      expect(apiAdminListNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'oldest' }),
      ),
    );
  });

  it('marks everything read', async () => {
    (apiAdminMarkAllNotificationsRead as jest.Mock).mockResolvedValue({ count: 1 });
    render(<NotificationDrawer open onClose={jest.fn()} />);
    await screen.findByText('New order #47');

    await userEvent.click(screen.getByRole('button', { name: /mark all read/i }));

    await waitFor(() => expect(apiAdminMarkAllNotificationsRead).toHaveBeenCalled());
  });

  it('shows an empty state only when there really is nothing', async () => {
    (apiAdminListNotifications as jest.Mock).mockResolvedValue(result([]));
    render(<NotificationDrawer open onClose={jest.fn()} />);
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();
  });

  it('surfaces a load failure with a retry, instead of pretending it is empty', async () => {
    (apiAdminListNotifications as jest.Mock).mockRejectedValue({ status: 500, message: 'boom' });
    render(<NotificationDrawer open onClose={jest.fn()} />);
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('does not fetch while the drawer is closed', () => {
    render(<NotificationDrawer open={false} onClose={jest.fn()} />);
    expect(apiAdminListNotifications).not.toHaveBeenCalled();
  });
});
