import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdminProfileCard } from '@/app/dashboard/settings/SettingsClient';
import { Role } from '@/lib/auth/role';

/**
 * Task 17 — "Who gets an avatar and a brand logo".
 *
 * Owner's decision:
 *   Admin        -> avatar: yes, name+chip: yes, brand logo: yes
 *   Super Admin  -> avatar: NO,  name+chip: yes, brand logo: NO
 *   (Collaborator's own avatar lives in CollabBrandClient.tsx, not here.)
 *
 * The Brand logo tile edits the STORE's logo, not a personal one — that is
 * exactly why a platform-level Super Admin account (no single store) must
 * not see it, even though it passes every other guard in the app.
 */

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData: jest.fn() }),
}));

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: jest.fn(),
}));

jest.mock('@/lib/api/auth', () => ({
  apiUpdateMyProfile: jest.fn(),
  apiUploadMyAvatar: jest.fn(),
}));

jest.mock('@/lib/api/settings', () => ({
  apiUploadBrandLogo: jest.fn(),
}));

import { useUser } from '@/lib/hooks/use-auth';

const mockedUseUser = useUser as jest.Mock;

function userOf(role: (typeof Role)[keyof typeof Role], name: string) {
  return {
    data: { userId: 'u1', role, email: 'x@x.com', name, avatarUrl: null },
    isLoading: false,
  };
}

describe('AdminProfileCard — who gets an avatar and a brand logo (Task 17)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows avatar, name and brand logo for an admin', async () => {
    mockedUseUser.mockReturnValue(userOf(Role.ADMIN, 'Yusuf'));
    render(<AdminProfileCard onLogoUploaded={jest.fn()} />);

    expect(screen.getByTitle('Change avatar')).toBeInTheDocument();
    expect(screen.getByTitle('Change brand logo')).toBeInTheDocument();
    // The name field is filled in a microtask after mount (useMountedEffect),
    // so it must be awaited rather than asserted synchronously.
    expect(await screen.findByDisplayValue('Yusuf')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('shows only the name and role chip for a super admin — no avatar, no brand logo', async () => {
    mockedUseUser.mockReturnValue(userOf(Role.SUPERADMIN, 'Volta_superadmin'));
    render(<AdminProfileCard onLogoUploaded={jest.fn()} />);

    expect(await screen.findByDisplayValue('Volta_superadmin')).toBeInTheDocument();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.queryByTitle('Change avatar')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Change brand logo')).not.toBeInTheDocument();
  });

  it('does not hide the whole card for a super admin — the name field is still editable', async () => {
    mockedUseUser.mockReturnValue(userOf(Role.SUPERADMIN, 'Volta_superadmin'));
    render(<AdminProfileCard onLogoUploaded={jest.fn()} />);

    const nameInput = (await screen.findByDisplayValue('Volta_superadmin')) as HTMLInputElement;
    expect(nameInput).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('keeps both tiles for a second admin account (regression guard: only SUPERADMIN is gated)', async () => {
    mockedUseUser.mockReturnValue(userOf(Role.ADMIN, 'Another Admin'));
    render(<AdminProfileCard onLogoUploaded={jest.fn()} />);

    expect(screen.getByTitle('Change avatar')).toBeInTheDocument();
    expect(screen.getByTitle('Change brand logo')).toBeInTheDocument();
    await screen.findByDisplayValue('Another Admin');
  });
});
