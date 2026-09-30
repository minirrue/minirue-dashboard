/**
 * #144: `next dev` against the local backend gets media URLs on
 * http://localhost:8002, which next/image rejects unless the host is listed.
 * The local hosts (and the optimizer's private-IP opt-in) are added in dev
 * ONLY. The production `images` config is pinned exactly as it was.
 */
import type { NextConfig } from 'next';

function imagesFor(nodeEnv: string): NextConfig['images'] {
  const env = process.env as Record<string, string | undefined>;
  const previous = env.NODE_ENV;
  env.NODE_ENV = nodeEnv;
  try {
    let images: NextConfig['images'];
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      images = (require('@/next.config') as { default: NextConfig }).default.images;
    });
    return images;
  } finally {
    env.NODE_ENV = previous;
  }
}

describe('next.config images', () => {
  it('production is unchanged: https hosts only, no private-IP opt-in', () => {
    expect(imagesFor('production')).toStrictEqual({
      remotePatterns: [
        { protocol: 'https', hostname: 'backend.minirueshop.com' },
        { protocol: 'https', hostname: 'pre-backend.minirueshop.com' },
        { protocol: 'https', hostname: 'minirueshop.com' },
        { protocol: 'https', hostname: 'img.minirueshop.com' },
        { protocol: 'https', hostname: 'storage.minirueshop.com' },
        { protocol: 'https', hostname: 'picsum.photos' },
        { protocol: 'https', hostname: 'images.unsplash.com' },
        { protocol: 'https', hostname: 'source.unsplash.com' },
        { protocol: 'https', hostname: 'fastly.picsum.photos' },
        { protocol: 'https', hostname: 'res.cloudinary.com' },
      ],
    });
  });

  it('development also accepts the local backend on localhost and 127.0.0.1', () => {
    const images = imagesFor('development');
    expect(images?.dangerouslyAllowLocalIP).toBe(true);
    expect(images?.remotePatterns).toEqual(
      expect.arrayContaining([
        { protocol: 'http', hostname: 'localhost' },
        { protocol: 'http', hostname: '127.0.0.1' },
      ]),
    );
    // Everything production allows is still allowed in dev.
    expect(images?.remotePatterns).toEqual(
      expect.arrayContaining(imagesFor('production')!.remotePatterns as unknown[]),
    );
  });
});
