/**
 * dashboard#51 — the media mapping keeps what backend 0.116.0 now says about a
 * product media row (`kind`, `posterUrl`, `status`), and a product whose cover
 * is a video lists with the poster as its thumbnail rather than an `.mp4` in
 * an `<img>` (the products table and the bundle member picker both draw
 * `coverUrl` as an image).
 */

jest.mock('@/lib/api/client', () => ({ apiFetch: jest.fn() }));

import { apiFetch } from '@/lib/api/client';
import { getProduct, listProducts } from '@/lib/catalog/api';

const backendProduct = (media: unknown[]) => ({
  id: 'p1',
  slug: 'aventus',
  name: 'Aventus',
  brandId: 'b1',
  brandName: 'Creed',
  categoryId: 'c1',
  categoryName: 'Perfume',
  publishedState: 'DRAFT',
  variants: [],
  media,
  createdAt: '2026-09-13',
});

const row = (over: Record<string, unknown>) => ({
  id: 'm1',
  productId: 'p1',
  cloudinaryPublicId: '',
  galleryItemId: 'g1',
  role: 'COVER',
  url: 'https://img.test/a.webp',
  width: null,
  height: null,
  altText: null,
  sortOrder: 0,
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('mapMedia', () => {
  it('keeps kind, poster and status', async () => {
    (apiFetch as jest.Mock).mockResolvedValue(
      backendProduct([
        row({
          kind: 'video',
          status: 'processing',
          posterUrl: 'https://img.test/a-poster.webp',
        }),
      ]),
    );
    const p = await getProduct('p1');
    expect(p.media[0]).toMatchObject({
      kind: 'video',
      status: 'processing',
      posterUrl: 'https://img.test/a-poster.webp',
    });
  });

  it('reads a row from an older API as a ready image', async () => {
    (apiFetch as jest.Mock).mockResolvedValue(backendProduct([row({})]));
    const p = await getProduct('p1');
    expect(p.media[0]).toMatchObject({ kind: 'image', status: 'ready', posterUrl: null });
  });
});

describe('coverUrl in the product list', () => {
  it('is the poster when the cover is a video', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({
      data: [
        backendProduct([
          row({
            kind: 'video',
            status: 'ready',
            url: 'https://s3.test/a.mp4',
            posterUrl: 'https://img.test/a-poster.webp',
          }),
        ]),
      ],
      meta: { total: 1 },
    });
    const { items } = await listProducts();
    expect(items[0].coverUrl).toBe('https://img.test/a-poster.webp');
  });

  it('is null, not the movie, for a video cover with no poster', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({
      data: [
        backendProduct([
          row({ kind: 'video', status: 'ready', url: 'https://s3.test/a.mp4', posterUrl: null }),
        ]),
      ],
      meta: { total: 1 },
    });
    const { items } = await listProducts();
    expect(items[0].coverUrl).toBeNull();
  });

  it('is the photo url for a photo cover, as before', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({
      data: [backendProduct([row({ kind: 'image', status: 'ready' })])],
      meta: { total: 1 },
    });
    const { items } = await listProducts();
    expect(items[0].coverUrl).toBe('https://img.test/a.webp');
  });
});
