import { render, screen } from '@testing-library/react';
import CollabSupportClient from '@/app/dashboard/collab/support/CollabSupportClient';
import { Role } from '@/lib/auth/role';

/**
 * Task U — the collab support page must render the SAME shell as the admin
 * inbox at /support, never a fork, and must never mount that inbox (and so
 * never fire a single support request) before the signed-in viewer's own id
 * is known. Before this fix: `.collab-portal-shell` (every /collab/* page's
 * wrapper) broke the chat's full-bleed layout, and nothing gated the inbox on
 * viewer identity at all.
 */

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: jest.fn(),
}));

// SupportInboxClient itself is the admin page's real component — stubbed
// here only so this test can assert IT (not a copy) is what renders, and
// with what props, without dragging in its full data layer.
jest.mock('@/app/dashboard/support/SupportInboxClient', () => ({
  __esModule: true,
  default: (props: { showPresence?: boolean }) => (
    <div data-testid="support-inbox-client" data-show-presence={String(!!props.showPresence)} />
  ),
}));

import { useUser } from '@/lib/hooks/use-auth';

const mockUseUser = useUser as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CollabSupportClient', () => {
  it('renders a loading panel, and mounts NO SupportInboxClient at all, while the viewer id is unknown', () => {
    mockUseUser.mockReturnValue({ data: undefined, isLoading: true });
    render(<CollabSupportClient />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('support-inbox-client')).not.toBeInTheDocument();
  });

  it('still shows the loading panel, not the inbox, if isLoading has cleared but no user id has arrived yet', () => {
    mockUseUser.mockReturnValue({ data: undefined, isLoading: false });
    render(<CollabSupportClient />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('support-inbox-client')).not.toBeInTheDocument();
  });

  it('renders the SAME SupportInboxClient the admin /support page uses, with the same showPresence shell, once the viewer id resolves', () => {
    mockUseUser.mockReturnValue({
      data: { userId: 'collab-user-1', role: Role.COLLAB, email: 'helia@example.com' },
      isLoading: false,
    });
    render(<CollabSupportClient />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const inbox = screen.getByTestId('support-inbox-client');
    expect(inbox).toBeInTheDocument();
    // Same prop the admin page passes (app/dashboard/support/page.tsx renders
    // `<SupportInboxClient showPresence />`) — parity, not a divergent shell.
    expect(inbox.getAttribute('data-show-presence')).toBe('true');
  });
});
