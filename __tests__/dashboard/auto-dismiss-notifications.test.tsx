import { renderHook, waitFor } from '@testing-library/react';
import { useAutoDismissNotifications } from '@/components/dashboard/notifications/useAutoDismissNotifications';
import type { AdminNotification } from '@/lib/api/notifications';

/**
 * #15, part 2 — the auto-dismiss `SupportInboxClient` has described in a
 * comment since it was written, and never did.
 *
 * `useAdminNotifications` handed back `items` and `markRead`; both were dropped
 * at the call site. So opening a conversation left its notification unread, and
 * the admin dismissed the same message a second time in the notification
 * centre — which is exactly the thing the comment promised they would not have
 * to do.
 */

function makeNotification(over: Partial<AdminNotification> = {}): AdminNotification {
  return {
    id: 1,
    type: 'support.support',
    category: 'SUPPORT',
    severity: 'INFO',
    title: 'Nadia sent a message',
    body: 'Is this in stock?',
    entityType: 'support',
    entityId: 'conv-1',
    actorName: 'Nadia',
    link: '/support?c=conv-1',
    isRead: false,
    data: null,
    createdAt: new Date().toISOString(),
    ...over,
  } as AdminNotification;
}

describe('useAutoDismissNotifications', () => {
  it('marks the open conversation’s notification read', async () => {
    const markRead = jest.fn();
    renderHook(() =>
      useAutoDismissNotifications('support', 'conv-1', [makeNotification()], markRead),
    );

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1));
  });

  it('leaves other conversations alone', async () => {
    const markRead = jest.fn();
    renderHook(() =>
      useAutoDismissNotifications(
        'support',
        'conv-1',
        [makeNotification({ id: 2, entityId: 'conv-2' })],
        markRead,
      ),
    );

    await waitFor(() => expect(markRead).not.toHaveBeenCalled());
  });

  it('leaves other entity types alone, even on a matching id', async () => {
    // Ids are not globally unique across entity types, so matching on the id
    // alone would dismiss an order notification for an open conversation.
    const markRead = jest.fn();
    renderHook(() =>
      useAutoDismissNotifications(
        'support',
        'conv-1',
        [makeNotification({ id: 3, entityType: 'order', entityId: 'conv-1' })],
        markRead,
      ),
    );

    await waitFor(() => expect(markRead).not.toHaveBeenCalled());
  });

  it('does nothing when no conversation is open', async () => {
    const markRead = jest.fn();
    renderHook(() =>
      useAutoDismissNotifications('support', null, [makeNotification()], markRead),
    );

    await waitFor(() => expect(markRead).not.toHaveBeenCalled());
  });

  it('does not re-mark a row that is already read', async () => {
    // `markRead` is optimistic: it flips `isRead` in the list, which changes
    // the array identity and re-runs this effect. Without the guard that is a
    // request per render.
    const markRead = jest.fn();
    renderHook(() =>
      useAutoDismissNotifications(
        'support',
        'conv-1',
        [makeNotification({ isRead: true })],
        markRead,
      ),
    );

    await waitFor(() => expect(markRead).not.toHaveBeenCalled());
  });

  it('marks every unread notification for the open conversation', async () => {
    // Several messages arrive before the admin opens the thread; reading it
    // clears all of them, not just the newest.
    const markRead = jest.fn();
    renderHook(() =>
      useAutoDismissNotifications(
        'support',
        'conv-1',
        [makeNotification({ id: 7 }), makeNotification({ id: 8 })],
        markRead,
      ),
    );

    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(2));
    expect(markRead).toHaveBeenCalledWith(7);
    expect(markRead).toHaveBeenCalledWith(8);
  });

  it('picks up a notification that arrives while the conversation is open', async () => {
    const markRead = jest.fn();
    const { rerender } = renderHook(
      ({ items }: { items: AdminNotification[] }) =>
        useAutoDismissNotifications('support', 'conv-1', items, markRead),
      { initialProps: { items: [] as AdminNotification[] } },
    );

    await waitFor(() => expect(markRead).not.toHaveBeenCalled());

    rerender({ items: [makeNotification({ id: 9 })] });

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(9));
  });
});
