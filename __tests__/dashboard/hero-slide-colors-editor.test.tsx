import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import HeroSlideColors from '@/app/dashboard/storefront-appearance/editors/HeroSlideColors';
import {
  HERO_COLOR_FIELDS,
  HERO_COLOR_PATTERN,
  HERO_COLOR_THEME_DEFAULTS,
} from '@/lib/hero-slide-colors';
import { normalizeStorefrontLayoutForSave } from '@/lib/api/storefront';
import type { HeroSlide, StorefrontLayout } from '@/lib/api/storefront';

/**
 * The single most important behaviour in this feature: opening the editor and
 * saving without touching a colour must leave all six overrides null.
 *
 * A bare `<input type="color">` cannot express null — it always holds a value,
 * and an unset one reads as `#000000`. Bind one straight to a nullable field
 * and merely rendering the editor proposes black for six slots on every slide;
 * the next unrelated save then repaints every hero on the site black. These
 * tests are the guard rail on that, and on the other half of the contract: the
 * dashboard must never emit anything the backend's hex regex would reject,
 * because zod rejects the WHOLE layout on one bad value, not just the colour.
 */

const slide = (over: Partial<HeroSlide> = {}): HeroSlide => ({
  id: 's1',
  mode: 'image',
  eyebrow: 'New in',
  headline: 'Oud Royale',
  sub: 'A study in resin',
  tagline: 'Warm, unhurried, and unmistakably itself.',
  imageGalleryItemId: null,
  mobileImageGalleryItemId: null,
  imageAlt: '',
  background: '#0B0B0B',
  bottle: null,
  cap: null,
  ctaLabel: 'Shop the edit',
  ctaTarget: { kind: 'scroll' },
  eyebrowColor: null,
  headlineColor: null,
  subColor: null,
  taglineColor: null,
  ctaBgColor: null,
  ctaTextColor: null,
  ...over,
});

/** Open the collapsed <details> the way an admin does. jsdom honours `open`. */
function renderOpen(props: Partial<React.ComponentProps<typeof HeroSlideColors>> = {}) {
  const onPatch = jest.fn();
  const view = render(
    <HeroSlideColors slide={props.slide ?? slide()} onPatch={props.onPatch ?? onPatch} />,
  );
  const details = view.container.querySelector('details') as HTMLDetailsElement;
  details.open = true;
  return { onPatch, details, ...view };
}

describe('an untouched slide stays on the theme', () => {
  it('renders no colour input at all while every field is unset', () => {
    const { container } = renderOpen();

    // The null state deliberately has no <input type="color"> on screen. There
    // is nothing to commit #000000 from, by construction.
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Pick a colour' })).toHaveLength(6);
  });

  it('patches nothing on mount or on expand', () => {
    const { onPatch } = renderOpen();
    expect(onPatch).not.toHaveBeenCalled();
  });

  it('says so on the collapsed summary', () => {
    renderOpen();
    expect(screen.getByText('All theme default')).toBeInTheDocument();
  });

  it('survives a save with all six still null — the whole point', () => {
    // The save path an admin's "Save changes" actually takes. Nothing touched
    // the colours, so nothing may come out of here but nulls.
    const layout = {
      sections: [{ id: 'h1', type: 'hero', enabled: true, order: 0, slides: [slide()], autoplayMs: 6000, ariaLabel: 'Hero', scrollCueLabel: 'Scroll' }],
      navbar: { items: [] },
      mobileMenu: { shortcuts: [], footerButton: null },
      pages: [],
    } as unknown as StorefrontLayout;

    const { layout: saved } = normalizeStorefrontLayoutForSave(layout);
    const out = (saved.sections[0] as { slides: HeroSlide[] }).slides[0];

    for (const field of HERO_COLOR_FIELDS) {
      expect(out[field]).toBeNull();
    }
  });

  it('coerces a colour that is somehow not a valid hex to null rather than failing the save', () => {
    // Defence in depth: the UI cannot produce these, and one of them reaching
    // zod would reject the admin's entire layout, not just the colour.
    const layout = {
      sections: [
        {
          id: 'h1',
          type: 'hero',
          enabled: true,
          order: 0,
          autoplayMs: 6000,
          ariaLabel: 'Hero',
          scrollCueLabel: null,
          slides: [
            slide({
              taglineColor: '' as unknown as string,
              ctaBgColor: 'rgb(1,2,3)',
              headlineColor: '#abc',
            }),
          ],
        },
      ],
      navbar: { items: [] },
      mobileMenu: { shortcuts: [], footerButton: null },
      pages: [],
    } as unknown as StorefrontLayout;

    const { layout: saved } = normalizeStorefrontLayoutForSave(layout);
    const out = (saved.sections[0] as { slides: HeroSlide[] }).slides[0];

    expect(out.taglineColor).toBeNull();
    expect(out.ctaBgColor).toBeNull();
    expect(out.headlineColor).toBe('#abc'); // valid shorthand survives untouched
  });
});

describe('picking a colour', () => {
  it('seeds the current theme colour, never #000000', async () => {
    const user = userEvent.setup();
    const { onPatch } = renderOpen();

    await user.click(screen.getAllByRole('button', { name: 'Pick a colour' })[3]);

    expect(onPatch).toHaveBeenCalledWith({ taglineColor: HERO_COLOR_THEME_DEFAULTS.taglineColor });
    expect(HERO_COLOR_THEME_DEFAULTS.taglineColor).not.toBe('#000000');
  });

  it('shows a picker and a hex box once set, and counts the override', () => {
    const { container } = renderOpen({ slide: slide({ taglineColor: '#ff0000' }) });

    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(1);
    expect(screen.getByLabelText('Tagline hex code')).toHaveValue('#ff0000');
    expect(screen.getByText('1 of 6 custom')).toBeInTheDocument();
  });

  it('commits only values that match the pinned regex while the admin types', async () => {
    const user = userEvent.setup();
    const onPatch = jest.fn();
    renderOpen({ slide: slide({ taglineColor: '#ff0000' }), onPatch });

    const hex = screen.getByLabelText('Tagline hex code');
    await user.clear(hex);
    await user.type(hex, '#1a2b3c');

    // Clearing and every intermediate keystroke ("#", "#1", "#1a"…) must not
    // reach the slide: each one fails the backend regex and would take the
    // whole save down. Only the complete hex commits.
    for (const call of onPatch.mock.calls) {
      expect(call[0].taglineColor).toMatch(HERO_COLOR_PATTERN);
    }
    expect(onPatch).toHaveBeenCalledWith({ taglineColor: '#1a2b3c' });
  });

  it('flags an uncommittable draft without discarding the saved value', async () => {
    const user = userEvent.setup();
    const onPatch = jest.fn();
    renderOpen({ slide: slide({ taglineColor: '#ff0000' }), onPatch });

    const hex = screen.getByLabelText('Tagline hex code');
    await user.clear(hex);
    await user.type(hex, 'zz');

    expect(screen.getByText(/Not a hex colour yet/)).toBeInTheDocument();
    expect(onPatch).not.toHaveBeenCalled();
  });
});

describe('going back to the theme', () => {
  it('is one button, and it writes a real null — never an empty string', async () => {
    const user = userEvent.setup();
    const onPatch = jest.fn();
    renderOpen({ slide: slide({ taglineColor: '#ff0000' }), onPatch });

    await user.click(screen.getByRole('button', { name: 'Theme default' }));

    expect(onPatch).toHaveBeenCalledWith({ taglineColor: null });
    // '' passes `!value` checks and looks like "cleared", and fails the
    // backend regex. It must never be what reset produces.
    expect(onPatch.mock.calls[0][0].taglineColor).not.toBe('');
  });

  it('offers the reset on every field that is set', () => {
    renderOpen({
      slide: slide({
        eyebrowColor: '#111111',
        headlineColor: '#222222',
        subColor: '#333333',
        taglineColor: '#444444',
        ctaBgColor: '#555555',
        ctaTextColor: '#666666',
      }),
    });

    expect(screen.getAllByRole('button', { name: 'Theme default' })).toHaveLength(6);
    expect(screen.queryByRole('button', { name: 'Pick a colour' })).not.toBeInTheDocument();
    expect(screen.getByText('6 of 6 custom')).toBeInTheDocument();
  });
});

describe('contrast guidance warns, never blocks', () => {
  it('flags an unreadable button pair with a real, computed ratio', () => {
    renderOpen({ slide: slide({ ctaBgColor: '#ffffff', ctaTextColor: '#f4f4f4' }) });

    const advice = screen.getByText(/Button text on button fill contrast is/);
    expect(advice).toHaveAttribute('role', 'status'); // advice, not an alert
    // Nothing is disabled and no value was rejected — the admin can still ship it.
    expect(screen.getAllByRole('button', { name: 'Theme default' }).length).toBeGreaterThan(0);
  });

  it('says nothing about a button pair that reads fine', () => {
    renderOpen({ slide: slide({ ctaBgColor: '#ffffff', ctaTextColor: '#0b0b0b' }) });
    expect(screen.queryByText(/Button text on button fill contrast/)).not.toBeInTheDocument();
  });

  it('measures text against a flat editorial background', () => {
    renderOpen({
      slide: slide({ mode: 'editorial', background: '#f6f2e9', taglineColor: '#f0ecdf' }),
    });
    expect(screen.getByText(/Tagline contrast is/)).toBeInTheDocument();
  });

  it('offers no number over a photograph, where there is no single answer', () => {
    renderOpen({
      slide: slide({ imageGalleryItemId: 'g1', taglineColor: '#f0ecdf' }),
      onPatch: jest.fn(),
    });

    expect(screen.queryByText(/Tagline contrast is/)).not.toBeInTheDocument();
    expect(screen.getByText(/judge it in the preview above/)).toBeInTheDocument();
  });
});

describe('the preview', () => {
  it('paints unset lines in the theme colour and set lines in the chosen one', () => {
    const { container } = renderOpen({ slide: slide({ taglineColor: '#ff0000' }) });

    const preview = container.querySelector('.hero-color-preview') as HTMLElement;
    const tagline = within(preview).getByText(/Warm, unhurried/);
    const headline = within(preview).getByText('Oud Royale');

    expect(tagline).toHaveStyle({ color: '#ff0000' });
    expect(headline).toHaveStyle({ color: HERO_COLOR_THEME_DEFAULTS.headlineColor });
  });
});
