import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Role } from '@/lib/auth/role';

/**
 * QC 2026-07-30 — defect 3: signing in as a collaborator flashed "you don't
 * have access" for about a second before the workspace rendered.
 *
 * Root cause: '/overview' is the universal post-login landing path
 * (app/login/page.tsx always does `router.push('/overview')`), but a COLLAB
 * role has no access to '/overview' (lib/auth/roles.ts: '/overview' is
 * ADMIN_ONLY). DashboardLayoutClient already has an effect that notices this
 * and redirects to firstAccessibleDashboardRoute(role) — but that effect
 * runs AFTER the commit, and the access-denied branch was computed
 * synchronously from the current (still '/overview') path in the same
 * render. So every collaborator briefly saw AccessDeniedPanel for real,
 * before the corrective router.replace() landed. This was a genuine "denial
 * computed for a path we're already in the middle of navigating away from",
 * not a display-only glitch.
 *
 * The fix folds "this is '/overview' and the redirect-away effect is about
 * to fire" into the same not-ready-to-render-a-verdict state as the loading
 * shell, so the denial only ever renders once it means it — matching the
 * general rule: never show denied while the real answer is still resolving.
 */

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockPathname = '/overview';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => mockPathname,
}));

jest.mock('@/lib/hooks/use-auth', () => ({ useUser: jest.fn() }));
jest.mock('@/lib/auth/tokens', () => ({ getAccessToken: () => 'test-token' }));

jest.mock('@/components/dashboard', () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/dashboard/AccessDeniedPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="access-denied">You don&apos;t have access</div>,
}));
jest.mock('@/components/dashboard/MaintenancePanel', () => ({
  __esModule: true,
  default: () => <div data-testid="maintenance">Under maintenance</div>,
}));
jest.mock('@/components/dashboard/ActingAsBanner', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import DashboardLayoutClient from '@/app/dashboard/DashboardLayoutClient';
import { useUser } from '@/lib/hooks/use-auth';

const mockedUseUser = useUser as jest.Mock;

function collabUser() {
  return {
    data: { userId: 'u1', role: Role.COLLAB, email: 'partner@helia.example', name: 'Helia' },
    isLoading: false,
    isError: false,
  };
}

describe('DashboardLayoutClient — no access-denied flash while a role is redirected off /overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/overview';
  });

  it('never renders AccessDeniedPanel for a collaborator bounced off the universal /overview landing', async () => {
    mockedUseUser.mockReturnValue(collabUser());

    render(
      <DashboardLayoutClient>
        <div data-testid="protected">Workspace</div>
      </DashboardLayoutClient>,
    );

    // The corrective redirect firing at all is proof the scenario actually
    // occurred (role genuinely can't see '/overview'); the assertion that
    // matters is that AccessDeniedPanel was not painted on the way there.
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/collab/workspace'));
    expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument();
  });

  it('still shows AccessDeniedPanel for a genuine deep link the role cannot reach', async () => {
    mockPathname = '/settings';
    mockedUseUser.mockReturnValue(collabUser());

    render(
      <DashboardLayoutClient>
        <div data-testid="protected">Workspace</div>
      </DashboardLayoutClient>,
    );

    expect(await screen.findByTestId('access-denied')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renders the workspace normally for a role that can reach /overview', async () => {
    mockedUseUser.mockReturnValue({
      data: { userId: 'u2', role: Role.ADMIN, email: 'admin@minirueshop.com', name: 'Admin' },
      isLoading: false,
      isError: false,
    });

    render(
      <DashboardLayoutClient>
        <div data-testid="protected">Workspace</div>
      </DashboardLayoutClient>,
    );

    expect(await screen.findByTestId('protected')).toBeInTheDocument();
    expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
