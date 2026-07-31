import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { apiUploadBrandLogo } from '@/lib/api/settings';

const mockedUseUser = useUser as jest.Mock;
const mockedUploadBrandLogo = apiUploadBrandLogo as jest.Mock;

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
    render(<AdminProfileCard logoUrl={null} onLogoUploaded={jest.fn()} />);

    expect(screen.getByTitle('Change avatar')).toBeInTheDocument();
    expect(screen.getByTitle('Change brand logo')).toBeInTheDocument();
    // The name field is filled in a microtask after mount (useMountedEffect),
    // so it must be awaited rather than asserted synchronously.
    expect(await screen.findByDisplayValue('Yusuf')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('shows only the name and role chip for a super admin — no avatar, no brand logo', async () => {
    mockedUseUser.mockReturnValue(userOf(Role.SUPERADMIN, 'Volta_superadmin'));
    render(<AdminProfileCard logoUrl={null} onLogoUploaded={jest.fn()} />);

    expect(await screen.findByDisplayValue('Volta_superadmin')).toBeInTheDocument();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.queryByTitle('Change avatar')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Change brand logo')).not.toBeInTheDocument();
  });

  it('does not hide the whole card for a super admin — the name field is still editable', async () => {
    mockedUseUser.mockReturnValue(userOf(Role.SUPERADMIN, 'Volta_superadmin'));
    render(<AdminProfileCard logoUrl={null} onLogoUploaded={jest.fn()} />);

    const nameInput = (await screen.findByDisplayValue('Volta_superadmin')) as HTMLInputElement;
    expect(nameInput).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('keeps both tiles for a second admin account (regression guard: only SUPERADMIN is gated)', async () => {
    mockedUseUser.mockReturnValue(userOf(Role.ADMIN, 'Another Admin'));
    render(<AdminProfileCard logoUrl={null} onLogoUploaded={jest.fn()} />);

    expect(screen.getByTitle('Change avatar')).toBeInTheDocument();
    expect(screen.getByTitle('Change brand logo')).toBeInTheDocument();
    await screen.findByDisplayValue('Another Admin');
  });
});

/**
 * Regression for the owner report "uploaded the brand logo, refresh, still
 * not there". Root cause was NOT missing storage — the upload endpoint
 * persisted correctly all along — it was that this tile rendered a fixed
 * placeholder SVG unconditionally, never the real `brand.logoUrl`, win or
 * fail, so a genuine success and a swallowed failure were indistinguishable.
 */
describe('AdminProfileCard — brand logo upload feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseUser.mockReturnValue(userOf(Role.ADMIN, 'Yusuf'));
  });

  function pickLogoFile() {
    const file = new File(['logo-bytes'], 'logo.png', { type: 'image/png' });
    const input = screen.getByTitle('Change brand logo')
      .parentElement!.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
  }

  it('shows the new logo immediately on a successful upload and hands the fresh settings up', async () => {
    const updatedSettings = { brand: { logoUrl: 'https://cdn.example/logo-new.png' } };
    mockedUploadBrandLogo.mockResolvedValue(updatedSettings);
    const onLogoUploaded = jest.fn();

    render(<AdminProfileCard logoUrl={null} onLogoUploaded={onLogoUploaded} />);
    pickLogoFile();

    await waitFor(() => expect(onLogoUploaded).toHaveBeenCalledWith(updatedSettings));
    // The tile must show a real image (the locally-held bytes, via
    // UploadPreviewImage) rather than the placeholder icon it always showed
    // before, win or fail.
    await waitFor(() => {
      expect(screen.getByTitle('Change brand logo').querySelector('img')).toBeInTheDocument();
    });
  });

  it('surfaces a readable error next to the tile when the upload fails, instead of failing silently', async () => {
    mockedUploadBrandLogo.mockRejectedValue({ message: 'Logo file exceeds 10 MB limit' });
    const onLogoUploaded = jest.fn();

    render(<AdminProfileCard logoUrl={null} onLogoUploaded={onLogoUploaded} />);
    pickLogoFile();

    expect(await screen.findByText('Logo file exceeds 10 MB limit')).toBeInTheDocument();
    expect(onLogoUploaded).not.toHaveBeenCalled();
    // Still no real image to show — the placeholder is correct here, not a bug.
    expect(screen.getByTitle('Change brand logo').querySelector('img')).not.toBeInTheDocument();
  });
});
