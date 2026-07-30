import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SupportInboxClient from '@/app/dashboard/support/SupportInboxClient';
import { Role } from '@/lib/auth/role';
import type { ConversationDto, SupportPersonDto } from '@/lib/api/support';

/**
 * Task 14 — the support inbox must default to MiniRue's own desk, and picking
 * a desk must scope the CONVERSATION list (not just the people rail) to that
 * desk. Before this fix: `deskFilter` defaulted to `''` ("All desks"), the
 * desk dropdown had no MiniRue option at all (the house channel's
 * `collaboratorId` is null, which the old filter dropped), and the desk was
 * threaded to the people rail only — `useSupportConversations` never received
 * a `brand`, so the middle pane bled every desk's rooms for whichever
 * customer was selected, on every desk.
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

const mockApiSupportChannels = jest.fn();
jest.mock('@/lib/api/support', () => ({
  apiSupportChannels: (...args: unknown[]) => mockApiSupportChannels(...args),
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
    conversationCount: 2,
    unreadCount: 0,
    lastMessageAt: '2026-07-30T10:00:00.000Z',
    lastMessageSnippet: 'Hi',
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
    lastMessagePreview: 'Hi',
    lastMessageSenderType: 'CUSTOMER',
    brandName: null,
    archivedAt: null,
    ...overrides,
  };
}

function mockChannels(channels: Array<{ id: string; collaboratorId: string | null; name: string }>) {
  mockApiSupportChannels.mockResolvedValue({ data: channels });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUser.mockReturnValue({ data: { role: Role.ADMIN, name: 'Admin' } });
  mockApiSupportChannels.mockResolvedValue({ data: [] });
  mockUsePeople.mockReturnValue({ data: [] });
  mockUseConversations.mockReturnValue({ data: [] });
  mockUseArchived.mockReturnValue({ data: [] });
  mockUseThread.mockReturnValue({ data: undefined, refetch: jest.fn() });
});

describe('SupportInboxClient — desk scope (Task 14)', () => {
  it('defaults the desk filter to MiniRue', async () => {
    render(<SupportInboxClient showPresence />);
    expect(await screen.findByDisplayValue('MiniRue')).toBeInTheDocument();
  });

  it('offers MiniRue as a desk option alongside partners', async () => {
    mockChannels([
      { id: 'c0', collaboratorId: null, name: 'MiniRue' },
      { id: 'c1', collaboratorId: 'helia', name: 'Helia' },
    ]);
    render(<SupportInboxClient showPresence />);
    expect(await screen.findByRole('option', { name: 'MiniRue' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Helia' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All desks' })).toBeInTheDocument();
  });

  it('passes the desk to the conversation list, not just the people rail', async () => {
    mockUsePeople.mockReturnValue({ data: [personDto()] });
    mockUseConversations.mockReturnValue({ data: [roomDto()] });

    render(<SupportInboxClient showPresence />);
    fireEvent.click(screen.getByText('Youssef'));

    await waitFor(() =>
      expect(mockUseConversations).toHaveBeenCalledWith(
        expect.objectContaining({ brand: 'direct' }),
      ),
    );
  });

  it('re-scopes the conversation list when a different desk is picked', async () => {
    mockChannels([
      { id: 'c0', collaboratorId: null, name: 'MiniRue' },
      { id: 'c1', collaboratorId: 'helia', name: 'Helia' },
    ]);
    mockUsePeople.mockReturnValue({ data: [personDto()] });
    mockUseConversations.mockReturnValue({ data: [roomDto()] });

    render(<SupportInboxClient showPresence />);
    await screen.findByRole('option', { name: 'Helia' });

    fireEvent.change(screen.getByLabelText('Filter by desk'), { target: { value: 'helia' } });

    await waitFor(() =>
      expect(mockUseConversations).toHaveBeenCalledWith(
        expect.objectContaining({ brand: 'helia' }),
      ),
    );
  });
});
