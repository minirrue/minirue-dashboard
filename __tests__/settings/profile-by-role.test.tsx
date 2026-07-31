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

// A STABLE spy, not a fresh `jest.fn()` per call: the "Your name" tests below
// have to assert which query key a successful save writes to, and a throwaway
// mock records nothing that survives the render.
const setQueryData = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData }),
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
import { apiUpdateMyProfile } from '@/lib/api/auth';

const mockedUseUser = useUser as jest.Mock;
const mockedUploadBrandLogo = apiUploadBrandLogo as jest.Mock;
const mockedUpdateMyProfile = apiUpdateMyProfile as jest.Mock;

function userOf(role: (typeof Role)[keyof typeof Role], name: string) {
  return {
    data: { userId: 'u1', role, email: 'x@x.com', name, avatarUrl: null },
    isLoading: false,
  };
}

/**
 * The shape `/auth/me`, `PATCH /auth/me` and `POST /auth/me/avatar` all
 * return: `name` is the GREETING form (first word only, the app-wide
 * "Hi, {name}" rule) and `fullName` is the untouched stored value.
 */
function userWithFullName(name: string, fullName: string) {
  return {
    data: {
      userId: 'u1',
      role: Role.ADMIN,
      email: 'x@x.com',
      name,
      fullName,
      avatarUrl: null,
    },
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

  /**
   * The reported symptom is specifically about what happens AFTER the page
   * reloads: "the page refreshes and we don't see the thumbnail, as if we
   * still have to upload again". Every other test in this file passes
   * `logoUrl={null}` and asserts on the just-uploaded local bytes, which is a
   * different code path (`uploadedLogoUrl`/`pendingLogoFile`) and stays green
   * even if the persisted-logo path renders nothing at all.
   *
   * On a reload there is no local file and no upload in this session — the
   * ONLY thing the tile has is the resolved `brand.logoUrl` the parent read
   * from GET /settings. That is what this covers.
   */
  it('renders the stored logo on a fresh page load, with no upload in this session', async () => {
    const stored = 'https://img.minirueshop.com/sig/rs:fit:1600:0:0/czovL21pbmlydWU';

    render(<AdminProfileCard logoUrl={stored} onLogoUploaded={jest.fn()} />);

    const img = await waitFor(() => {
      const found = screen.getByTitle('Change brand logo').querySelector('img');
      expect(found).toBeInTheDocument();
      return found!;
    });
    expect(img).toHaveAttribute('src', stored);
  });

  it('keeps showing the stored logo — it never falls back to the placeholder while a remote URL exists', async () => {
    const stored = 'https://img.minirueshop.com/sig/rs:fit:1600:0:0/czovL21pbmlydWU';

    render(<AdminProfileCard logoUrl={stored} onLogoUploaded={jest.fn()} />);

    await screen.findByTitle('Change brand logo');
    // The placeholder SVG and a real image are mutually exclusive: before the
    // fix the tile rendered that SVG unconditionally, win or fail, so an
    // upload that had genuinely worked was indistinguishable from one that
    // had not.
    expect(
      screen.getByTitle('Change brand logo').querySelector('svg'),
    ).not.toBeInTheDocument();
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

/**
 * Owner report, 2026-07-31: "inside Your name field its bugged when we enter
 * mini rue, it remove rue and leaves mini only — bugged on spaces".
 *
 * Nothing ever stripped the space. `user.name` is the GREETING form by design
 * (first word only — the app-wide "Hi, {name}" rule), and this editable field
 * used to seed itself from it. The whole name sat untouched in the database
 * the entire time; the input collapsed to one word the moment any fresh
 * `/auth/me` read landed. The field must seed from `fullName`, and a
 * successful save must write a response CARRYING `fullName` into the very
 * query key `useUser` reads (`['auth','me']`) — a save that repopulates that
 * cache from a `fullName`-less response reintroduces the bug on the next
 * render, not on the next reload.
 */
describe('AdminProfileCard — "Your name" keeps its spaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('seeds the input from the full name, not the first-word greeting form', async () => {
    mockedUseUser.mockReturnValue(userWithFullName('MINI', 'MINI RUE'));

    render(<AdminProfileCard logoUrl={null} onLogoUploaded={jest.fn()} />);

    expect(await screen.findByDisplayValue('MINI RUE')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('MINI')).not.toBeInTheDocument();
  });

  it('leaves Save disabled when the field already equals the stored full name', async () => {
    mockedUseUser.mockReturnValue(userWithFullName('MINI', 'MINI RUE'));

    render(<AdminProfileCard logoUrl={null} onLogoUploaded={jest.fn()} />);
    await screen.findByDisplayValue('MINI RUE');

    // Compared against `fullName`. Compared against `name` it would read
    // "MINI RUE" !== "MINI" and offer to re-save a name that never changed.
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('writes the save response — fullName included — into the same cache key useUser reads', async () => {
    mockedUseUser.mockReturnValue(userWithFullName('Yusuf', 'Yusuf'));
    const saved = {
      userId: 'u1',
      role: Role.ADMIN,
      email: 'x@x.com',
      name: 'MINI',
      fullName: 'MINI RUE',
      avatarUrl: null,
    };
    mockedUpdateMyProfile.mockResolvedValue(saved);

    render(<AdminProfileCard logoUrl={null} onLogoUploaded={jest.fn()} />);
    const input = await screen.findByDisplayValue('Yusuf');
    fireEvent.change(input, { target: { value: 'MINI RUE' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    // Sent verbatim — the space survives the write path.
    await waitFor(() => expect(mockedUpdateMyProfile).toHaveBeenCalledWith('MINI RUE'));
    // ...and lands in ['auth','me'], the exact key useUser() reads, carrying
    // `fullName`. Any other key leaves the form reading a stale cache.
    await waitFor(() =>
      expect(setQueryData).toHaveBeenCalledWith(['auth', 'me'], saved),
    );
    expect(setQueryData.mock.calls[0][1]).toHaveProperty('fullName', 'MINI RUE');
  });

  it('a fresh /auth/me landing after the save does not truncate the field back to one word', async () => {
    mockedUseUser.mockReturnValue(userWithFullName('Yusuf', 'Yusuf'));
    const { rerender } = render(
      <AdminProfileCard logoUrl={null} onLogoUploaded={jest.fn()} />,
    );
    await screen.findByDisplayValue('Yusuf');

    // The refetch the owner actually hits: a page refresh, a window refocus,
    // anything that re-runs the `['auth','me']` query.
    mockedUseUser.mockReturnValue(userWithFullName('MINI', 'MINI RUE'));
    rerender(<AdminProfileCard logoUrl={null} onLogoUploaded={jest.fn()} />);

    expect(await screen.findByDisplayValue('MINI RUE')).toBeInTheDocument();
  });
});
