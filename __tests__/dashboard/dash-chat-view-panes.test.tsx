import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DashChatView, type Conversation, type Person } from '@/components/DashChatView';

/**
 * W2.1 — the three-pane support inbox (people → rooms → thread). These tests
 * drive DashChatView directly with controlled props rather than through
 * SupportInboxClient's full data-fetching stack, since the pane
 * structure/grouping/avatar-fallback behaviour this batch is about lives
 * entirely in DashChatView itself; see support-inbox-client.test.tsx for the
 * mapping-level (unread rollup, filters, watch-only composer) coverage.
 */

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'cust-1',
    name: 'Youssef',
    avatarUrl: null,
    time: '12:27 AM',
    unread: 2,
    presence: 'ONLINE',
    chatCount: 3,
    ...overrides,
  };
}

function room(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'room-1',
    name: 'Youssef',
    preview: 'My order hasn\'t come',
    subject: 'My order hasn\'t come',
    time: '12:27 AM',
    unread: 1,
    presence: 'ONLINE',
    kind: 'GENERAL',
    customerId: 'cust-1',
    status: 'OPEN',
    archivedAt: null,
    ...overrides,
  };
}

const noop = () => {};

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
}

describe('DashChatView — below 1024px, three panes become three steps', () => {
  const realWidth = window.innerWidth;
  afterEach(() => setViewportWidth(realWidth));

  it('shows only the people pane at 390px, and a back arrow returns from rooms to people', () => {
    setViewportWidth(390);
    function Harness() {
      const [activePersonId, setActivePersonId] = useState<string | null>(null);
      const p = person();
      const r = room({ id: 'r1' });
      return (
        <DashChatView
          people={[p]}
          activePersonId={activePersonId}
          onSelectPerson={setActivePersonId}
          conversations={activePersonId === p.id ? [r] : []}
          activeId={null}
          onSelect={noop}
          messages={[]}
          onSend={noop}
        />
      );
    }
    render(<Harness />);

    expect(document.querySelector('.mrc-rail')).toBeTruthy();
    expect(document.querySelector('.mrc-rooms')).toBeNull();
    expect(document.querySelector('.mrc-thread')).toBeNull();

    fireEvent.click(screen.getByText('Youssef'));
    expect(document.querySelector('.mrc-rooms')).toBeTruthy();
    expect(document.querySelector('.mrc-rail')).toBeNull();

    fireEvent.click(screen.getByLabelText('Back to customers'));
    expect(document.querySelector('.mrc-rail')).toBeTruthy();
    expect(document.querySelector('.mrc-rooms')).toBeNull();
  });

  it('one click still opens the thread: selecting a person that auto-opens a room jumps straight past the rooms step', () => {
    setViewportWidth(390);
    function Harness() {
      const [activePersonId, setActivePersonId] = useState<string | null>(null);
      const [activeId, setActiveId] = useState<string | null>(null);
      const p = person();
      const r = room({ id: 'r1' });
      // Mirrors SupportInboxClient's selectPerson: the real inbox clears
      // activeId and an effect auto-picks the newest room once it loads. This
      // harness collapses that into one synchronous call.
      const selectPerson = (id: string) => {
        setActivePersonId(id);
        setActiveId('r1');
      };
      return (
        <DashChatView
          people={[p]}
          activePersonId={activePersonId}
          onSelectPerson={selectPerson}
          conversations={activePersonId === p.id ? [r] : []}
          activeId={activeId}
          onSelect={setActiveId}
          messages={[]}
          onSend={noop}
        />
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByText('Youssef'));

    expect(document.querySelector('.mrc-thread')).toBeTruthy();
    expect(document.querySelector('.mrc-rail')).toBeNull();
    expect(document.querySelector('.mrc-rooms')).toBeNull();
  });

  it('at 1440px all three panes render at once, with no back arrows', () => {
    setViewportWidth(1440);
    const p = person();
    const r = room({ id: 'r1' });
    render(
      <DashChatView
        people={[p]}
        activePersonId={p.id}
        onSelectPerson={noop}
        conversations={[r]}
        activeId={r.id}
        onSelect={noop}
        messages={[]}
        onSend={noop}
      />,
    );
    expect(document.querySelector('.mrc-rail')).toBeTruthy();
    expect(document.querySelector('.mrc-rooms')).toBeTruthy();
    expect(document.querySelector('.mrc-thread')).toBeTruthy();
    expect(screen.queryByLabelText('Back to customers')).toBeNull();
    expect(screen.queryByLabelText('Back to conversations')).toBeNull();
  });
});

describe('DashChatView — pane 1 (people) and pane 2 (rooms)', () => {
  it('renders one row in the people rail and three rows in the rooms pane for a customer with 3 rooms', () => {
    const p = person();
    const rooms = [
      room({ id: 'room-1', subject: 'My order hasn\'t come', status: 'OPEN' }),
      room({ id: 'room-2', subject: 'About No.1', status: 'RESOLVED' }),
      room({ id: 'room-3', subject: 'Where is my refund', status: 'CLOSED' }),
    ];

    render(
      <DashChatView
        people={[p]}
        activePersonId={p.id}
        onSelectPerson={noop}
        conversations={rooms}
        activeId={null}
        onSelect={noop}
        messages={[]}
        onSend={noop}
      />,
    );

    // The people list and rooms list both use role="list"/"listitem"; scope by
    // container class to tell them apart.
    const peopleRows = document.querySelectorAll('.mrc-list .mrc-row');
    const roomRows = document.querySelectorAll('.mrc-rooms-list .mrc-room-row');
    expect(peopleRows.length).toBe(1);
    expect(roomRows.length).toBe(3);
  });

  it('renders the person\'s rolled-up unread badge from the `unread` prop verbatim', () => {
    const p = person({ unread: 5 });
    render(
      <DashChatView
        people={[p]}
        activePersonId={null}
        onSelectPerson={noop}
        conversations={[]}
        activeId={null}
        onSelect={noop}
        messages={[]}
        onSend={noop}
      />,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows a real photo when the customer has an avatarUrl, and the generic icon when they do not', () => {
    const withPhoto = person({ id: 'cust-photo', name: 'Has Photo', avatarUrl: 'https://example.com/a.jpg' });
    const withoutPhoto = person({ id: 'cust-nophoto', name: 'No Photo', avatarUrl: null });

    render(
      <DashChatView
        people={[withPhoto, withoutPhoto]}
        activePersonId={null}
        onSelectPerson={noop}
        conversations={[]}
        activeId={null}
        onSelect={noop}
        messages={[]}
        onSend={noop}
      />,
    );

    expect(screen.getByAltText('Has Photo')).toHaveAttribute('src', 'https://example.com/a.jpg');
    // The no-photo row renders the generic glyph, not initials.
    const rows = document.querySelectorAll('.mrc-list .mrc-row');
    const noPhotoRow = Array.from(rows).find(r => r.textContent?.includes('No Photo'));
    expect(noPhotoRow?.querySelector('[data-testid="avatar-generic"]')).toBeTruthy();
    expect(noPhotoRow?.textContent).not.toMatch(/^NP|No Photo.*NP/);
  });

  it('renders the room status on its own meta line, never as one of several chips', () => {
    const p = person();
    render(
      <DashChatView
        people={[p]}
        activePersonId={p.id}
        onSelectPerson={noop}
        conversations={[room({ id: 'room-1', status: 'RESOLVED' })]}
        activeId={null}
        onSelect={noop}
        messages={[]}
        onSend={noop}
      />,
    );
    const status = screen.getByText('✓ Resolved');
    expect(status.className).toContain('mrc-room-status');
    expect(status.parentElement?.className).toContain('mrc-room-meta');
    // There is no shared "chips" row left to render a status inside of.
    expect(document.querySelector('.mrc-row-chips')).toBeNull();
  });

  it('groups live rooms first, history next, and archived rooms into a collapsed group', () => {
    const p = person();
    const rooms = [
      room({ id: 'live-1', status: 'OPEN', archivedAt: null }),
      room({ id: 'history-1', status: 'RESOLVED', archivedAt: null }),
      room({ id: 'archived-1', status: 'CLOSED', archivedAt: '2026-07-28T00:00:00.000Z' }),
    ];
    render(
      <DashChatView
        people={[p]}
        activePersonId={p.id}
        onSelectPerson={noop}
        conversations={rooms}
        activeId={null}
        onSelect={noop}
        messages={[]}
        onSend={noop}
      />,
    );
    // Only the two non-archived rooms are visible before expanding.
    expect(document.querySelectorAll('.mrc-rooms-list .mrc-room-row').length).toBe(2);
    expect(screen.getByText('Archived (1)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Archived (1)'));
    expect(document.querySelectorAll('.mrc-rooms-list .mrc-room-row').length).toBe(3);
  });

  it('archiving this customer\'s only room shows it directly, dimmed, with an explanatory notice — never gated behind a hidden toggle; restoring reverses it', () => {
    // W2.1 follow-up (2026-07-30): archiving EVERY one of a customer's rooms
    // must never make their last thread unreachable. When there is nothing
    // live or resolved left to collapse the archived group under, the pane
    // shows the archived room(s) directly instead of behind the collapsed
    // "Archived (N)" toggle used when other rooms are still visible.
    function Harness() {
      const p = person();
      const [rooms, setRooms] = useState<Conversation[]>([
        room({ id: 'r1', status: 'OPEN', archivedAt: null }),
      ]);
      return (
        <DashChatView
          people={[p]}
          activePersonId={p.id}
          onSelectPerson={noop}
          conversations={rooms}
          activeId={null}
          onSelect={noop}
          onArchive={(id) =>
            setRooms(prev => prev.map(r => (r.id === id ? { ...r, archivedAt: '2026-07-30T00:00:00.000Z' } : r)))
          }
          onRestore={(id) =>
            setRooms(prev => prev.map(r => (r.id === id ? { ...r, archivedAt: null } : r)))
          }
          messages={[]}
          onSend={noop}
        />
      );
    }
    render(<Harness />);

    expect(document.querySelectorAll('.mrc-rooms-list .mrc-room-row').length).toBe(1);
    expect(screen.queryByText(/is archived/)).toBeNull();

    fireEvent.click(screen.getByLabelText(/Archive conversation with Youssef/));
    // Still one row — shown directly, not hidden behind a toggle, since it's
    // the only room this customer has left.
    expect(document.querySelectorAll('.mrc-rooms-list .mrc-room-row').length).toBe(1);
    expect(screen.getByText(/is archived/)).toBeInTheDocument();
    expect(screen.queryByText('Archived (1)')).toBeNull();

    // Restorable straight away — no toggle to find first.
    fireEvent.click(screen.getByLabelText(/Restore conversation with Youssef/));
    expect(document.querySelectorAll('.mrc-rooms-list .mrc-room-row').length).toBe(1);
    expect(screen.queryByText(/is archived/)).toBeNull();
  });

  it('a customer with only archived rooms stays visible and selectable in the people rail, styled as archived, and their rooms pane opens straight to the archived rooms', () => {
    const p = person({ fullyArchived: true, chatCount: 2 });
    const rooms = [
      room({ id: 'archived-1', status: 'CLOSED', archivedAt: '2026-07-28T00:00:00.000Z' }),
      room({ id: 'archived-2', status: 'OPEN', archivedAt: '2026-07-29T00:00:00.000Z' }),
    ];
    render(
      <DashChatView
        people={[p]}
        activePersonId={p.id}
        onSelectPerson={noop}
        conversations={rooms}
        activeId={null}
        onSelect={noop}
        onArchive={noop}
        onRestore={noop}
        messages={[]}
        onSend={noop}
      />,
    );

    // Visible + selectable in the people rail, marked archived.
    const peopleList = document.querySelector('.mrc-list') as HTMLElement;
    const personRow = within(peopleList).getByText('Youssef').closest('.mrc-row');
    expect(personRow).toBeTruthy();
    expect(personRow).toHaveAttribute('data-archived', 'true');
    expect(within(peopleList).getByText(/Archived · 2/)).toBeInTheDocument();

    // Both archived rooms are directly reachable and restorable — no toggle
    // click required, and the pane explains why there's nothing else.
    expect(document.querySelectorAll('.mrc-rooms-list .mrc-room-row').length).toBe(2);
    expect(screen.queryByText(/Archived \(2\)/)).toBeNull();
    expect(screen.getByText(/Every conversation with Youssef is archived/)).toBeInTheDocument();
  });

  it('disables the composer and shows the reason instead of the reply field on a watch-only desk', () => {
    const p = person();
    const r = room({ id: 'r1', status: 'OPEN' });
    render(
      <DashChatView
        people={[p]}
        activePersonId={p.id}
        onSelectPerson={noop}
        conversations={[r]}
        activeId={r.id}
        onSelect={noop}
        messages={[]}
        onSend={noop}
        composerDisabled
        composerDisabledReason="Watching Helia's desk — read only. Only Helia can reply here."
      />,
    );
    expect(screen.getByText(/Watching Helia's desk/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Reply to customer…')).toBeNull();
  });

  it('never renders "Merge" or "GUEST" anywhere in the tree', () => {
    const p = person();
    const r = room({ id: 'r1', status: 'OPEN' });
    render(
      <DashChatView
        people={[p]}
        activePersonId={p.id}
        onSelectPerson={noop}
        conversations={[r]}
        activeId={r.id}
        onSelect={noop}
        messages={[{ from: 'cx', name: 'Youssef', text: 'Hi', time: '12:00', day: 'Today' }]}
        onSend={noop}
        threadActions={<span>Resolve &amp; close</span>}
      />,
    );
    expect(screen.queryByText(/Merge/)).toBeNull();
    expect(screen.queryByText(/GUEST/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Merge/);
    expect(document.body.textContent).not.toMatch(/GUEST/);
  });
});
