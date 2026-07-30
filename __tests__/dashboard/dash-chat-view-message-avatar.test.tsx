import { render, screen } from '@testing-library/react';
import { DashChatView, type Conversation, type Message } from '@/components/DashChatView';

/**
 * Task M (2026-07-30) — surfacing `senderAvatarUrl` (backend-resolved:
 * personal avatar -> (COLLAB) brand logo -> null) next to each message in
 * the thread. A URL renders the photo; null must render the generic
 * profile-icon fallback and NEVER an `<img>` — a broken image or an empty gap
 * is exactly what this batch exists to prevent.
 *
 * Updated 2026-07-30 (owner request: "any avatar, exchange it with generic
 * profile icon") — the fallback used to be the sender's initial letter; it is
 * now the same `GenericAvatarIcon` silhouette every other avatar slot in this
 * app falls back to, never a letter.
 */

function room(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'room-1',
    name: 'Youssef',
    preview: 'Hello',
    subject: 'Hello',
    time: '12:00 PM',
    unread: 0,
    presence: 'ONLINE',
    kind: 'GENERAL',
    status: 'OPEN',
    archivedAt: null,
    ...overrides,
  };
}

const noop = () => {};

describe('DashChatView — per-message sender avatar', () => {
  it('renders the photo when the message carries a senderAvatarUrl', () => {
    const messages: Message[] = [
      {
        from: 'cx',
        name: 'Youssef',
        senderAvatarUrl: 'https://example.com/avatar.jpg',
        text: 'Hello there',
        time: '12:00 PM',
      },
    ];

    render(
      <DashChatView
        people={[]}
        activePersonId={null}
        onSelectPerson={noop}
        conversations={[room()]}
        activeId="room-1"
        onSelect={noop}
        messages={messages}
        onSend={noop}
      />,
    );

    const img = screen.getByAltText('Youssef');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(screen.queryByTestId('msg-avatar-initial')).not.toBeInTheDocument();
  });

  it('falls back to the generic profile icon (no img element, no letter) when senderAvatarUrl is null', () => {
    const messages: Message[] = [
      {
        from: 'agent',
        name: 'Priya Kapoor',
        senderAvatarUrl: null,
        text: 'On it, one moment',
        time: '12:01 PM',
      },
    ];

    render(
      <DashChatView
        people={[]}
        activePersonId={null}
        onSelectPerson={noop}
        conversations={[room()]}
        activeId="room-1"
        onSelect={noop}
        messages={messages}
        onSend={noop}
      />,
    );

    const fallback = screen.getByTestId('msg-avatar-initial');
    // No letter anymore — the generic silhouette icon renders inside, and
    // nothing in the fallback reads as initials text.
    expect(fallback.textContent).toBe('');
    expect(fallback.querySelector('[data-testid="avatar-generic"]')).toBeTruthy();
    // No <img> anywhere in the thread scroll area — a null avatar must never
    // render a broken image, only the generic icon.
    expect(document.querySelector('.mrc-scroll img')).toBeNull();
  });
});
