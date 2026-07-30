import { render, screen } from '@testing-library/react';
import { DashChatView, type Conversation, type Message } from '@/components/DashChatView';

/**
 * Task M (2026-07-30) — surfacing `senderAvatarUrl` (backend-resolved:
 * personal avatar -> (COLLAB) brand logo -> null) next to each message in
 * the thread. A URL renders the photo; null must render the sender's
 * initial letter and NEVER an `<img>` — a broken image or an empty gap is
 * exactly what this batch exists to prevent.
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

  it('falls back to the initial letter (no img element) when senderAvatarUrl is null', () => {
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

    expect(screen.getByTestId('msg-avatar-initial')).toHaveTextContent('PK');
    // No <img> anywhere in the thread scroll area — a null avatar must never
    // render a broken image, only the initial.
    expect(document.querySelector('.mrc-scroll img')).toBeNull();
  });
});
