import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StorefrontAppearanceClient from '@/app/dashboard/storefront-appearance/StorefrontAppearanceClient';
import * as storefrontApi from '@/lib/api/storefront';
import { newSection } from '@/lib/api/storefront';
import type { StorefrontLayout } from '@/lib/api/storefront';

/**
 * The Mobile menu tab (W4b.1) — an admin edit has to survive a save and the
 * reload that follows it, the same round-trip guarantee the rest of the
 * Storefront appearance screen already has for the navbar and footer.
 */
jest.mock('@/lib/api/storefront', () => {
  const actual = jest.requireActual('@/lib/api/storefront');
  return {
    ...actual,
    apiGetStorefrontLayout: jest.fn(),
    apiSaveStorefrontLayout: jest.fn(),
  };
});

const mocked = storefrontApi as jest.Mocked<typeof storefrontApi>;

function baseLayout(): StorefrontLayout {
  return {
    version: 2,
    productSection: { perks: [] },
    announcement: { enabled: false, messages: [], linkUrl: null, background: null },
    faviconUrl: null,
    sections: [newSection('hero', 0)],
    navbar: { items: [], showSearch: true, showAccount: true },
    mobileMenu: {
      shortcuts: [
        { id: 'shortcut-home', label: 'Home', icon: 'home', target: { kind: 'home' } },
        { id: 'shortcut-search', label: 'Search', icon: 'search', target: { kind: 'search' } },
        { id: 'shortcut-account', label: 'Account', icon: 'user', target: { kind: 'account' } },
      ],
      footerButton: { label: 'Account', icon: 'user', target: { kind: 'account' } },
    },
    footer: {
      tagline: null,
      newsletterEnabled: false,
      newsletterEyebrow: '',
      newsletterBlurb: '',
      columns: [],
      socials: [],
      paymentBadges: [],
      legalLine: '',
      secondaryLine: '',
    },
    pages: [],
  };
}

describe('Mobile menu editor', () => {
  // The mocked API functions are shared module state across tests in this
  // file (jest.config.ts sets neither clearMocks nor resetMocks) — without
  // this, a later test's `toHaveBeenCalledTimes(1)` counts calls left over
  // from an earlier test too.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('round-trips a renamed shortcut through save and reload', async () => {
    const layout = baseLayout();
    mocked.apiGetStorefrontLayout.mockResolvedValue(layout);
    mocked.apiSaveStorefrontLayout.mockImplementation(async (sent) => sent);

    render(<StorefrontAppearanceClient />);
    await screen.findByText('Storefront');

    await userEvent.click(await screen.findByRole('button', { name: 'Mobile menu' }));

    // "Home" also appears as the selected option text of the first
    // shortcut's target <select> ("Goes to" -> Home), so disambiguate to the
    // <input> among the matches.
    const homeMatches = await screen.findAllByDisplayValue('Home');
    const homeLabel = homeMatches.find((el) => el.tagName === 'INPUT') as HTMLElement;
    expect(homeLabel).toBeDefined();
    await userEvent.clear(homeLabel);
    await userEvent.type(homeLabel, 'Shop home');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mocked.apiSaveStorefrontLayout).toHaveBeenCalledTimes(1));
    const sent = mocked.apiSaveStorefrontLayout.mock.calls[0][0];
    expect(sent.mobileMenu.shortcuts[0].label).toBe('Shop home');
    expect(sent.mobileMenu.shortcuts[0].target).toEqual({ kind: 'home' });
    // Untouched entries survive the round trip unchanged.
    expect(sent.mobileMenu.footerButton).toEqual(layout.mobileMenu.footerButton);

    // "Reload": the shell sets state from whatever the mocked save returned,
    // so the field must still show the edited value afterwards.
    expect(await screen.findByDisplayValue('Shop home')).toBeInTheDocument();
  });

  it('drops an unfinished shortcut (no label) on save without blocking the rest', async () => {
    const layout = baseLayout();
    layout.mobileMenu.shortcuts.push({
      id: 'shortcut-blank',
      label: '',
      icon: 'grid',
      target: { kind: 'brands' },
    });
    mocked.apiGetStorefrontLayout.mockResolvedValue(layout);
    mocked.apiSaveStorefrontLayout.mockImplementation(async (sent) => sent);

    render(<StorefrontAppearanceClient />);
    await screen.findByText('Storefront');
    await userEvent.click(await screen.findByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mocked.apiSaveStorefrontLayout).toHaveBeenCalledTimes(1));
    const sent = mocked.apiSaveStorefrontLayout.mock.calls[0][0];
    expect(sent.mobileMenu.shortcuts).toHaveLength(3);
    expect(sent.mobileMenu.shortcuts.some((s) => s.id === 'shortcut-blank')).toBe(false);

    expect(
      await screen.findByText(/1 unfinished mobile-menu tile was removed on save/i),
    ).toBeInTheDocument();
  });

  it('removing the footer button saves it as null', async () => {
    const layout = baseLayout();
    mocked.apiGetStorefrontLayout.mockResolvedValue(layout);
    mocked.apiSaveStorefrontLayout.mockImplementation(async (sent) => sent);

    render(<StorefrontAppearanceClient />);
    await screen.findByText('Storefront');
    await userEvent.click(await screen.findByRole('button', { name: 'Mobile menu' }));

    // 3 shortcuts + the footer button each render their own "Remove" — the
    // footer button's is the last one in DOM order.
    const removeButtons = await screen.findAllByRole('button', { name: 'Remove' });
    await userEvent.click(removeButtons[removeButtons.length - 1]);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mocked.apiSaveStorefrontLayout).toHaveBeenCalledTimes(1));
    const sent = mocked.apiSaveStorefrontLayout.mock.calls[0][0];
    expect(sent.mobileMenu.footerButton).toBeNull();
  });
});
