import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SupportInboxClient from '@/app/dashboard/support/SupportInboxClient';
import { Role } from '@/lib/auth/role';
import type { ConversationDto, SupportPersonDto } from '@/lib/api/support';

/**
 * W2.1 — integration-level coverage for the mapping/orchestration
 * SupportInboxClient itself owns: the unread rollup and 3-rooms-for-1-person
 * flow through real DTO shapes, the filter row's `.dash-filters` wrapper
 * (defect 1), and the watch-only composer gate driven by the open room's own
 * `collaboratorId`. Pane structure/grouping/avatar-fallback is covered at the
 * DashChatView level in dash-chat-view-panes.test.tsx.
 */

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: jest.fn(),
}));

jest.mock('@/lib/api/collab-portal', () => ({
  apiCollabOverview: jest.fn().mockResolvedValue({ modules: [] }),
}));

jest.mock('@/components/dashboard/notifications/useAdminNotifications', () => ({
  useAdminNotifications: () => ({ items: [], markRead: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/lib/hooks/use-clear-nav-badge', () => ({
  useClearNavBadge: jest.fn(),
}));

jest.mock('@/lib/api/support', () => ({
  apiSupportChannels: jest.fn().mockResolvedValue({ data: [] }),
  apiSupportSend: jest.fn(),
}));

jest.mock('@/lib/hooks/use-support', () => ({
  useSupportPeople: jest.fn(),
  useSupportConversations: jest.fn(),
  useSupportArchivedConversations: jest.fn(),
  useSupportThread: jest.fn(),
  useSupportLiveSync: jest.fn(),
  useSupportPresence: jest.fn(() => ({ data: undefined })),
  useSetPresence: jest.fn(() => ({ mutate: jest.fn() })),
  useSupportUpload: jest.fn(() => ({ mutateAsync: jest.fn() })),
  useSupportMarkRead: jest.fn(() => ({ mutate: jest.fn() })),
  useUpdateConversation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useArchiveConversation: jest.fn(() => ({ mutate: jest.fn(), isPending: false, variables: undefined })),
  useRestoreConversation: jest.fn(() => ({ mutate: jest.fn(), isPending: false, variables: undefined })),
}));

import { useUser } from '@/lib/hooks/use-auth';
import {
  useSupportPeople,
  useSupportConversations,
  useSupportArchivedConversations,
  useSupportThread,
} from '@/lib/hooks/use-support';

const mockUseUser = useUser as jest.Mock;
const mockUsePeople = useSupportPeople as jest.Mock;
const mockUseConversations = useSupportConversations as jest.Mock;
const mockUseArchived = useSupportArchivedConversations as jest.Mock;
const mockUseThread = useSupportThread as jest.Mock;

function personDto(overrides: Partial<SupportPersonDto> = {}): SupportPersonDto {
  return {
    customerId: 'cust-1',
    name: 'Youssef',
    email: 'youssef@example.com',
    avatarUrl: null,
    presence: 'ONLINE',
    conversationCount: 3,
    unreadCount: 2,
    lastMessageAt: '2026-07-30T10:00:00.000Z',
    lastMessageSnippet: "My order hasn't come",
    lastMessageSenderType: 'CUSTOMER',
    ...overrides,
  };
}

function roomDto(overrides: Partial<ConversationDto> = {}): ConversationDto {
  return {
    id: 'room-1',
    type: 'GENERAL',
    status: 'OPEN',
    customerId: 'cust-1',
    customerName: 'Youssef',
    customerEmail: 'youssef@example.com',
    customerPhone: null,
    guestName: null,
    guestEmail: null,
    collaboratorId: null,
    productId: null,
    subjectSnapshot: null,
    lastMessageAt: '2026-07-30T10:00:00.000Z',
    customerReadAt: null,
    teamReadAt: null,
    customerPresence: 'ONLINE',
    lastMessagePreview: "My order hasn't come",
    lastMessageSenderType: 'CUSTOMER',
    brandName: null,
    archivedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUser.mockReturnValue({ data: { role: Role.ADMIN, name: 'Admin' } });
  mockUseArchived.mockReturnValue({ data: [] });
  mockUseThread.mockReturnValue({ data: undefined, refetch: jest.fn() });
});

describe('SupportInboxClient — people/rooms mapping', () => {
  it('a customer with 3 rooms renders 1 row in the people rail and 3 in the rooms pane, with the unread rollup badge', async () => {
    mockUsePeople.mockReturnValue({ data: [personDto({ unreadCount: 2 })] });
    mockUseConversations.mockImplementation((opts: { customerId?: string }) =>
      opts?.customerId === 'cust-1'
        ? {
            data: [
              roomDto({ id: 'room-1', status: 'OPEN' }),
              roomDto({ id: 'room-2', status: 'RESOLVED' }),
              roomDto({ id: 'room-3', status: 'CLOSED' }),
            ],
          }
        : { data: [] },
    );

    render(<SupportInboxClient showPresence />);

    expect(document.querySelectorAll('.mrc-list .mrc-row').length).toBe(1);
    expect(screen.getByText('2')).toBeInTheDocument(); // rolled-up unread badge

    fireEvent.click(screen.getByText('Youssef'));

    await waitFor(() => {
      expect(document.querySelectorAll('.mrc-rooms-list .mrc-room-row').length).toBe(3);
    });
  });

  it('renders both filter selects inside a .dash-filters element', () => {
    mockUsePeople.mockReturnValue({ data: [] });
    mockUseConversations.mockReturnValue({ data: [] });

    render(<SupportInboxClient showPresence />);

    const wrapper = document.querySelector('.dash-filters');
    expect(wrapper).toBeTruthy();
    const statusSelect = screen.getByLabelText('Filter by status');
    const deskSelect = screen.getByLabelText('Filter by desk');
    expect(wrapper?.contains(statusSelect)).toBe(true);
    expect(wrapper?.contains(deskSelect)).toBe(true);
  });

  it('disables the composer with an explanation when the open room belongs to a partner desk', async () => {
    mockUsePeople.mockReturnValue({ data: [personDto()] });
    mockUseConversations.mockReturnValue({
      data: [roomDto({ id: 'room-1', status: 'OPEN', collaboratorId: 'collab-1', brandName: 'Helia' })],
    });
    mockUseThread.mockImplementation((id: string | null) =>
      id
        ? {
            data: {
              conversation: roomDto({ id: 'room-1', status: 'OPEN', collaboratorId: 'collab-1', brandName: 'Helia' }),
              messages: [],
            },
            refetch: jest.fn(),
          }
        : { data: undefined, refetch: jest.fn() },
    );

    render(<SupportInboxClient showPresence />);
    fireEvent.click(screen.getByText('Youssef'));

    await waitFor(() => {
      expect(screen.getByText(/Watching/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Watching/).textContent).toMatch(/Helia/);
    expect(screen.queryByLabelText('Reply to customer…')).toBeNull();
  });

  it('never renders "Merge" or "GUEST" anywhere in the tree', () => {
    mockUsePeople.mockReturnValue({ data: [personDto()] });
    mockUseConversations.mockReturnValue({ data: [roomDto()] });

    render(<SupportInboxClient showPresence />);

    expect(document.body.textContent).not.toMatch(/Merge/);
    expect(document.body.textContent).not.toMatch(/GUEST/);
  });
});
