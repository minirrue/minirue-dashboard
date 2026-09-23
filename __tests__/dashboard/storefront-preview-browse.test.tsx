/**
 * Edit / Browse above the Storefront editor's preview (dashboard#130).
 * Owner: "a button above preview to leave layout click on or off … simulate
 * mouse buttons and keyboard there without layout editing".
 *
 * The protocol strings are the storefront's (minirue-frontend#196).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import PreviewPane from '@/app/dashboard/storefront-appearance/PreviewPane';
import type { StorefrontLayout } from '@/lib/api/storefront';

jest.mock('@/lib/api/storefront', () => ({
  normalizeStorefrontLayoutForSave: (layout: unknown) => ({ layout }),
  apiPreviewStorefrontLayout: jest.fn(async () => ({ home: { sections: [] }, chrome: {} })),
}));

const ORIGIN = 'https://minirueshop.com';

function setup(props: Partial<React.ComponentProps<typeof PreviewPane>> = {}) {
  const onSelect = jest.fn();
  const utils = render(
    <PreviewPane
      layout={{} as StorefrontLayout}
      view="home"
      device="desktop"
      onDeviceChange={() => {}}
      onSelect={onSelect}
      title="Home page"
      subtitle="Scroll"
      {...props}
    />,
  );
  const frame = utils.container.querySelector('iframe') as HTMLIFrameElement;
  const posted: unknown[] = [];
  jest.spyOn(frame.contentWindow as Window, 'postMessage').mockImplementation((data: unknown) => {
    posted.push(data);
  });
  const fromShop = (data: object) =>
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data, origin: ORIGIN, source: frame.contentWindow }));
    });
  return { ...utils, onSelect, posted, fromShop };
}

beforeEach(() => window.localStorage.clear());

it('starts in Edit, and Browse tells the shop to let clicks and keys through', async () => {
  const { posted, fromShop } = setup();
  expect(screen.getByRole('button', { name: /Edit/ })).toHaveAttribute('aria-pressed', 'true');

  fromShop({ type: 'mr-preview:ready' });
  expect(posted).toContainEqual({ type: 'mr-preview:mode', interactive: false });

  fireEvent.click(screen.getByRole('button', { name: /Browse/ }));
  expect(posted).toContainEqual({ type: 'mr-preview:mode', interactive: true });
  expect(screen.getByRole('button', { name: /Browse/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText(/Nothing is edited/)).toBeInTheDocument();
  expect(window.localStorage.getItem('sfe.preview.browse')).toBe('1');
});

it('offers a followed link on the live shop unless the editor showed it itself', async () => {
  const onNavigate = jest.fn((href: string) => href === '/shop/serums/vita-c');
  const { fromShop } = setup({ onNavigate });
  fromShop({ type: 'mr-preview:ready' });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 450));
  });

  fromShop({ type: 'mr-preview:navigate', href: '/shop/serums/vita-c' });
  expect(onNavigate).toHaveBeenCalledWith('/shop/serums/vita-c');
  expect(screen.queryByText(/which the preview can’t show/)).toBeNull();

  fromShop({ type: 'mr-preview:navigate', href: '/shop' });
  expect(screen.getByText(/which the preview can’t show/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Open live/ })).toHaveAttribute('href', `${ORIGIN}/shop`);
});

it('ignores messages from anywhere but the framed shop', () => {
  const { onSelect } = setup();
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'mr-preview:select', target: 'footer' }, origin: 'https://evil.test' }));
  });
  expect(onSelect).not.toHaveBeenCalled();
});

it('never renders the product view without a product', async () => {
  const { posted, fromShop } = setup({ view: 'product', productSlug: null });
  fromShop({ type: 'mr-preview:ready' });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 450));
  });
  expect(posted.some((m) => (m as { type: string }).type === 'mr-preview:render')).toBe(false);
  expect(screen.getByText('Choosing a product to show…')).toBeInTheDocument();
});
