import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  LinkTarget,
  HREF_LINK_KINDS,
  blankTarget,
  canKindRepresentHref,
  hrefForTarget,
  inferLinkKind,
  isHrefKind,
  nextTargetForKind,
  readStoredTarget,
  resolveTarget,
  targetFromHref,
  writeStoredTarget,
  type LinkTargetContext,
  type LinkTargetValue,
  type StoredLinkTarget,
} from '@/components/storefront-appearance/LinkTarget';
import type { StorefrontPage } from '@/lib/api/storefront';

/**
 * The `LinkTarget` primitive (#102).
 *
 * The Storefront Appearance tab had four separate notions of "where does this
 * link go" — `NavItem.kind` (5 kinds), `CtaTarget` (5), `MobileMenuTarget` (10)
 * and `LinkKind` (4) — each with its own kind list, its own conditional picker
 * and its own URL conventions. These tests are written against the three
 * defects that fragmentation produced, plus the round trip that keeps the two
 * storage shapes honest, rather than against the rendering.
 */

/**
 * Radix builds Select on pointer capture and scroll-into-view, neither of which
 * jsdom implements. Same shims as `sa-fields.test.tsx`.
 */
beforeAll(() => {
  const proto = window.Element.prototype as unknown as Record<string, unknown>;
  if (typeof proto.hasPointerCapture !== 'function') proto.hasPointerCapture = () => false;
  if (typeof proto.setPointerCapture !== 'function') proto.setPointerCapture = () => undefined;
  if (typeof proto.releasePointerCapture !== 'function') {
    proto.releasePointerCapture = () => undefined;
  }
  if (typeof proto.scrollIntoView !== 'function') proto.scrollIntoView = () => undefined;
  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

jest.mock('@/lib/catalog/api', () => ({
  listCategories: jest.fn(async () => ({
    items: [
      { id: 'cat-1', slug: 'perfumes', name: 'Perfumes', children: [] },
      { id: 'cat-2', slug: 'candles', name: 'Candles', children: [] },
    ],
  })),
  listManagedBrands: jest.fn(async () => [
    { id: 'brand-1', name: 'Dior' },
    { id: 'brand-2', name: 'Helia' },
  ]),
  listProducts: jest.fn(async () => ({ items: [{ id: 'prod-1', name: 'Amber', brandName: null }] })),
}));

jest.mock('@/lib/api/collaborators', () => ({
  apiListCollaborators: jest.fn(async () => ({
    items: [{ id: 'collab-1', brandName: 'Helia', brandSlug: 'helia' }],
  })),
}));

const PAGES: StorefrontPage[] = [
  { id: 'p1', slug: 'shipping', title: 'Shipping', body: '', enabled: true },
  { id: 'p2', slug: 'returns', title: 'Returns', body: '', enabled: true },
];

const CTX: LinkTargetContext = {
  pageSlugs: ['shipping', 'returns'],
  categories: [
    { id: 'cat-1', slug: 'perfumes', label: 'Perfumes' },
    { id: 'cat-2', slug: 'candles', label: 'Candles' },
  ],
  brands: [
    { id: 'brand-1', label: 'Dior' },
    { id: 'brand-2', label: 'Helia' },
  ],
};

/** A controlled host — these are controlled components, so a test that expects
 *  a second interaction to see the first one's result has to hold the value. */
function HrefHost({
  initial,
  spy,
  kinds,
}: {
  initial: string;
  spy: jest.Mock;
  kinds?: readonly Parameters<typeof isHrefKind>[0][];
}) {
  const [href, setHref] = React.useState(initial);
  return (
    <LinkTarget
      stores="href"
      value={href}
      pages={PAGES}
      kinds={kinds ?? ['page', 'category', 'brand', 'url']}
      onChange={(next) => {
        spy(next);
        setHref(next);
      }}
    />
  );
}

const kindSelect = () => screen.getByRole('combobox', { name: 'Goes to' });

/* ------------------------------------------------------------------ */
/* Defect 1 — LinkTargetField.tsx:60-66                                */
/* ------------------------------------------------------------------ */

describe('Defect 1 — re-picking the kind already chosen must not wipe the href', () => {
  /*
   * The old picker ran `onChange('')` in the kind select's change handler
   * unconditionally, with the comment "Clear the href when switching kind".
   * It did not switch kind on every change event — selecting the option that
   * was already selected is also a change event — so an admin who opened the
   * dropdown on a saved brand link and clicked "Brand" again lost the link.
   */
  it('returns the current target by identity when the kind did not change', () => {
    const current: LinkTargetValue = { kind: 'brand', brandId: 'brand-1' };
    expect(nextTargetForKind(current, 'brand')).toBe(current);
  });

  it('still blanks the value when the kind genuinely changed', () => {
    const current: LinkTargetValue = { kind: 'brand', brandId: 'brand-1' };
    expect(nextTargetForKind(current, 'category')).toEqual({ kind: 'category', categoryId: '' });
  });

  it('emits nothing at all when the same kind is chosen again', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<HrefHost initial="/shop/all?brandId=brand-1" spy={spy} />);

    // Opens on Brand, because that is what the stored href says.
    expect(kindSelect()).toHaveTextContent('Brand');

    await user.click(kindSelect());
    await user.click(await screen.findByRole('option', { name: 'Brand' }));

    expect(spy).not.toHaveBeenCalled();
    expect(kindSelect()).toHaveTextContent('Brand');
  });

  it('does clear when the kind really changes', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<HrefHost initial="/shop/all?brandId=brand-1" spy={spy} />);

    await user.click(kindSelect());
    await user.click(await screen.findByRole('option', { name: 'Shop page' }));

    expect(spy).toHaveBeenCalledWith('');
  });
});

/* ------------------------------------------------------------------ */
/* Defect 2 — LinkTargetField.tsx:43                                   */
/* ------------------------------------------------------------------ */

describe('Defect 2 — the kind must re-sync when the stored href changes underneath', () => {
  /*
   * The old picker seeded `kind` with `useState(() => inferLinkKind(...))` and
   * never looked again. The client replaces the whole layout after a save
   * (`setLayout(result)`), so an href that came back re-inferring differently
   * left the dropdown describing a value that was no longer stored.
   */
  it('follows an href replaced from outside onto its new kind', async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <LinkTarget
        stores="href"
        value="/shop/all?brandId=brand-1"
        pages={PAGES}
        kinds={['page', 'category', 'brand', 'url']}
        onChange={onChange}
      />,
    );
    expect(kindSelect()).toHaveTextContent('Brand');
    // Let the brand picker's options land before re-rendering, so the assertion
    // below is about the kind and not about a list still in flight.
    await screen.findByRole('option', { name: 'Dior' });

    rerender(
      <LinkTarget
        stores="href"
        value="/shop/perfumes"
        pages={PAGES}
        kinds={['page', 'category', 'brand', 'url']}
        onChange={onChange}
      />,
    );

    expect(kindSelect()).toHaveTextContent('Category');
    await screen.findByRole('option', { name: 'Perfumes' });
    // Re-syncing is a display concern; it must not write anything back.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps a deliberate "Custom link" choice while its box is still empty', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<HrefHost initial="/shop/perfumes" spy={spy} />);

    await user.click(kindSelect());
    await user.click(await screen.findByRole('option', { name: 'Custom link' }));

    // The href is now '', which infers as `page` — the naive fix (re-deriving
    // the kind every render) would snap the dropdown back and strand the admin.
    expect(spy).toHaveBeenCalledWith('');
    expect(kindSelect()).toHaveTextContent('Custom link');
    expect(screen.getByRole('textbox', { name: 'Link' })).toHaveValue('');
  });

  it('spells that rule out: an empty href suits any kind, any href suits a custom link', () => {
    expect(canKindRepresentHref('brand', '', CTX)).toBe(true);
    expect(canKindRepresentHref('url', '/shop/perfumes', CTX)).toBe(true);
    expect(canKindRepresentHref('page', '/shop/perfumes', CTX)).toBe(false);
    expect(canKindRepresentHref('category', '/shop/perfumes', CTX)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Defect 3 — LinkTargetField.tsx:119                                  */
/* ------------------------------------------------------------------ */

describe('Defect 3 — a brand link must not be saved pointing at a 308 redirect', () => {
  /*
   * `/products` is a documented permanent redirect into `/shop/all`
   * (minirue-frontend next.config.ts; noted in this tab at PagesEditor.tsx:31),
   * so every footer brand link the old picker saved pointed at a redirect. The
   * canonical shape is `/shop/all?brandId=<id>`: the storefront's own listing
   * page calls `brandId` the scoped filter and `brand` legacy, and the name
   * filter is a case-SENSITIVE `eq(brands.name, …)` that a rename breaks
   * silently. The id is also the only thing the brand picker actually has —
   * brand options carry `{ id, label }` and no slug.
   */
  it('emits the canonical brandId shape when a brand is picked', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<HrefHost initial="" spy={spy} kinds={['brand']} />);

    const picker = await screen.findByRole('combobox', { name: 'Brand' });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Dior' })).toBeInTheDocument());
    await user.selectOptions(picker, 'brand-1');

    expect(spy).toHaveBeenCalledWith('/shop/all?brandId=brand-1');
  });

  it('never emits the redirecting shape for any brand', () => {
    const href = hrefForTarget({ kind: 'brand', brandId: 'brand-1' }, CTX);
    expect(href).toBe('/shop/all?brandId=brand-1');
    expect(href).not.toContain('/products');
    expect(href).not.toContain('brand=');
  });

  it('still reads every brand shape that was ever saved', () => {
    // The shape the old picker emitted…
    expect(inferLinkKind('/products?brand=Dior', CTX)).toBe('brand');
    // …the shape the old `inferLinkKind` also accepted (:24)…
    expect(inferLinkKind('/brands/dior', CTX)).toBe('brand');
    // …the same filter at its post-redirect address…
    expect(inferLinkKind('/shop/all?brand=Dior', CTX)).toBe('brand');
    // …and the canonical one.
    expect(inferLinkKind('/shop/all?brandId=brand-1', CTX)).toBe('brand');
  });

  it('resolves a legacy brand name or slug onto the real brand', () => {
    expect(resolveTarget(targetFromHref('/products?brand=Dior', CTX), CTX)).toMatchObject({
      kind: 'brand',
      brandId: 'brand-1',
    });
    expect(resolveTarget(targetFromHref('/brands/dior', CTX), CTX)).toMatchObject({
      kind: 'brand',
      brandId: 'brand-1',
    });
  });

  it('opens a legacy brand link on the right brand, and re-saves it canonical', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<HrefHost initial="/products?brand=Dior" spy={spy} />);

    expect(kindSelect()).toHaveTextContent('Brand');
    const picker = await screen.findByRole('combobox', { name: 'Brand' });
    await waitFor(() => expect(picker).toHaveValue('brand-1'));

    await user.selectOptions(picker, 'brand-2');
    expect(spy).toHaveBeenCalledWith('/shop/all?brandId=brand-2');
  });

  it('leaves the legacy href alone until the admin actually changes something', async () => {
    const spy = jest.fn();
    render(<HrefHost initial="/products?brand=Dior" spy={spy} />);
    await screen.findByRole('option', { name: 'Dior' });
    expect(spy).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* Canonical URLs and round-tripping                                   */
/* ------------------------------------------------------------------ */

describe('one canonical URL per entity kind', () => {
  const CANONICAL: Array<[string, LinkTargetValue]> = [
    ['/', { kind: 'home' }],
    ['/search', { kind: 'search' }],
    ['/account', { kind: 'account' }],
    ['/cart', { kind: 'cart' }],
    ['/collab', { kind: 'brands' }],
    ['/shipping', { kind: 'page', slug: 'shipping' }],
    ['/shop/perfumes', { kind: 'category', categoryId: 'cat-1' }],
    ['/shop/all?brandId=brand-1', { kind: 'brand', brandId: 'brand-1' }],
    ['https://instagram.com/minirue', { kind: 'url', url: 'https://instagram.com/minirue' }],
  ];

  it.each(CANONICAL)('round-trips %s', (href, target) => {
    expect(inferLinkKind(href, CTX)).toBe(target.kind);
    expect(hrefForTarget(resolveTarget(targetFromHref(href, CTX), CTX), CTX)).toBe(href);
  });

  const LEGACY: Array<[string, string]> = [
    // Every one of these is a permanent 308 on the storefront.
    ['/pages/shipping', '/shipping'],
    ['/categories/perfumes', '/shop/perfumes'],
    ['/products?brand=Dior', '/shop/all?brandId=brand-1'],
    ['/shop/all?brand=Dior', '/shop/all?brandId=brand-1'],
    ['/brands/dior', '/shop/all?brandId=brand-1'],
    ['/brands', '/collab'],
  ];

  it.each(LEGACY)('rewrites the redirecting %s to %s', (legacy, canonical) => {
    expect(hrefForTarget(resolveTarget(targetFromHref(legacy, CTX), CTX), CTX)).toBe(canonical);
  });

  it('treats an unknown path as a custom link rather than guessing', () => {
    expect(inferLinkKind('/not-a-page', CTX)).toBe('url');
    expect(inferLinkKind('mailto:hi@minirue.com', CTX)).toBe('url');
  });

  it('infers a page only against pages that actually exist', () => {
    expect(inferLinkKind('/shipping', CTX)).toBe('page');
    expect(inferLinkKind('/shipping', {})).toBe('url');
  });
});

/* ------------------------------------------------------------------ */
/* The id-vs-href split                                                */
/* ------------------------------------------------------------------ */

describe('the id/href split is declared, not improvised', () => {
  /*
   * `product` needs /shop/<categorySlug>/<productSlug> and `collaborator` needs
   * /collab/<slug>; EntityPicker supplies `{ id, label }` for both and no slug,
   * so neither has an href projection. `scroll` is in-page behaviour on a hero
   * CTA and is not a URL at all. Saying so in the registry is what keeps the
   * href round trip total.
   */
  it.each(['product', 'collaborator', 'scroll'] as const)(
    '%s is structured-only — it has no href',
    (kind) => {
      expect(hrefForTarget(blankTarget(kind), CTX)).toBeNull();
      expect(isHrefKind(kind)).toBe(false);
      expect(HREF_LINK_KINDS).not.toContain(kind);
    },
  );

  it('never infers a kind an href-storing call site could not write back', () => {
    for (const href of [
      '',
      '/',
      '/collab/helia',
      '/shop/perfumes/amber',
      '/products?brand=Dior',
      '/brands/dior',
      'https://example.com',
    ]) {
      expect(isHrefKind(inferLinkKind(href, CTX))).toBe(true);
    }
  });

  it('never shows a kind the call site did not offer', async () => {
    // An empty href infers as `page`, which this call site does not offer —
    // without the fallback the dropdown would sit on its placeholder above a
    // page picker nobody asked for.
    render(
      <LinkTarget
        stores="href"
        value=""
        kinds={['category', 'brand', 'url']}
        onChange={jest.fn()}
      />,
    );
    expect(kindSelect()).toHaveTextContent('Category');
    expect(await screen.findByRole('combobox', { name: 'Category' })).toBeInTheDocument();
  });

  it('drops a structured-only kind from an href call site that asks for it', async () => {
    const user = userEvent.setup();
    render(
      <LinkTarget
        stores="href"
        value=""
        pages={PAGES}
        kinds={['page', 'product', 'collaborator', 'url']}
        onChange={jest.fn()}
      />,
    );
    await user.click(kindSelect());
    expect(await screen.findByRole('option', { name: 'Shop page' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Custom link' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Product' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Collaborator brand' })).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* Target mode                                                         */
/* ------------------------------------------------------------------ */

describe('target mode stores ids, and stores them in the caller’s own dialect', () => {
  it('reads and writes the { kind: "link"; href } spelling NavItem and MobileMenuTarget use', () => {
    const stored: StoredLinkTarget = { kind: 'link', href: '/journal' };
    const { target, dialect } = readStoredTarget(stored);
    expect(target).toEqual({ kind: 'url', url: '/journal' });
    expect(dialect).toBe('link');
    expect(writeStoredTarget(target, dialect)).toEqual({ kind: 'link', href: '/journal' });
  });

  it('leaves the { kind: "url"; url } spelling CtaTarget uses alone', () => {
    const { target, dialect } = readStoredTarget({ kind: 'url', url: '/journal' });
    expect(dialect).toBe('url');
    expect(writeStoredTarget(target, dialect)).toEqual({ kind: 'url', url: '/journal' });
  });

  it('hands back a structured id, never an href', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <LinkTarget
        value={{ kind: 'category', categoryId: '' } as LinkTargetValue}
        kinds={['scroll', 'product', 'category', 'brand', 'url']}
        onChange={onChange}
      />,
    );

    const picker = await screen.findByRole('combobox', { name: 'Category' });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Perfumes' })).toBeInTheDocument());
    await user.selectOptions(picker, 'cat-1');

    expect(onChange).toHaveBeenCalledWith({ kind: 'category', categoryId: 'cat-1' });
  });

  it('writes a custom link back in the dialect it was given', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <LinkTarget
        value={{ kind: 'link', href: '' } as StoredLinkTarget}
        kinds={['category', 'url']}
        onChange={onChange}
      />,
    );

    // One keystroke: the host here holds `value` fixed, so a second would be
    // applied to the same empty string rather than accumulating.
    await user.type(screen.getByRole('textbox', { name: 'Link' }), '/');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'link', href: '/' });
  });

  it('takes its kind straight from the value, so it can never go stale', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <LinkTarget
        value={{ kind: 'cart' } as LinkTargetValue}
        kinds={['home', 'cart', 'account']}
        onChange={onChange}
      />,
    );
    expect(kindSelect()).toHaveTextContent('Cart');

    rerender(
      <LinkTarget
        value={{ kind: 'account' } as LinkTargetValue}
        kinds={['home', 'cart', 'account']}
        onChange={onChange}
      />,
    );
    expect(kindSelect()).toHaveTextContent('Account');
  });

  it('offers exactly the subset a call site names, in that order', async () => {
    const user = userEvent.setup();
    render(
      <LinkTarget
        value={{ kind: 'scroll' } as LinkTargetValue}
        kinds={['scroll', 'product', 'category', 'brand', 'url']}
        kindLabels={{ category: 'A category page', brand: "A brand's products" }}
        onChange={jest.fn()}
      />,
    );

    await user.click(kindSelect());
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual([
      'Scroll to the products below',
      'Product',
      'A category page',
      "A brand's products",
      'Custom link',
    ]);
  });
});
