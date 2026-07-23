import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StorefrontAppearanceClient from '@/app/dashboard/storefront-appearance/StorefrontAppearanceClient';
import * as storefrontApi from '@/lib/api/storefront';
import { newSection } from '@/lib/api/storefront';
import type { StorefrontLayout } from '@/lib/api/storefront';

/**
 * The save path is the one true choke point that must never let a
 * half-finished picker (empty-string uuid CTA target, or an incomplete nav
 * item) reach the backend and 400 the whole PATCH. See lib/api/storefront.ts
 * normalizeStorefrontLayoutForSave for the unit-level guarantee; this test
 * proves the shell actually calls it before saving.
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

function layoutWithUnfinishedPickers(): StorefrontLayout {
  const hero = newSection('hero', 0);
  if (hero.type !== 'hero') throw new Error('expected hero');
  hero.slides[0].ctaTarget = { kind: 'product', productId: '' };

  return {
    version: 2,
    announcement: { enabled: false, messages: [], linkUrl: null, background: null },
    faviconUrl: null,
    sections: [hero],
    navbar: {
      items: [{ id: 'nav-1', kind: 'product', productId: '', label: 'Featured' }],
      showSearch: true,
      showAccount: true,
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
  };
}

describe('StorefrontAppearanceClient save path', () => {
  it('normalizes an unfinished CTA target and drops an incomplete nav item before saving, and tells the admin', async () => {
    const layout = layoutWithUnfinishedPickers();
    mocked.apiGetStorefrontLayout.mockResolvedValue(layout);
    mocked.apiSaveStorefrontLayout.mockImplementation(async (sent) => sent);

    render(<StorefrontAppearanceClient />);

    await screen.findByText('Storefront');
    await userEvent.click(await screen.findByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mocked.apiSaveStorefrontLayout).toHaveBeenCalledTimes(1));

    const sent = mocked.apiSaveStorefrontLayout.mock.calls[0][0];
    const sentHero = sent.sections[0];
    if (sentHero.type !== 'hero') throw new Error('expected hero');
    expect(sentHero.slides[0].ctaTarget).toEqual({ kind: 'scroll' });
    expect(sent.navbar.items).toEqual([]);

    expect(await screen.findByText(/1 unfinished menu item was removed on save/i)).toBeInTheDocument();
  });
});
