import React from 'react';
import { act, render, waitFor, within } from '@testing-library/react';
import MediaSection from '@/app/dashboard/products/[slug]/edit/MediaSection';
import type { ProductMedia } from '@/lib/catalog/types';
import type { GalleryItem } from '@/lib/gallery/types';

/**
 * dashboard#51 — the product media grid drew every row as a photo.
 *
 * A product can hold videos (backend#89), and a video can still be converting
 * or have failed to (backend#123). The rows now say what they are
 * (`kind`/`posterUrl`/`status`, minirue-backend@0.116.0) and the grid uses the
 * shared media tile: a video is its poster with a play glyph and, when not
 * ready, the Converting/Failed badge — never its movie URL in an `<img>`.
 */

jest.mock('@/lib/catalog/api', () => ({
  cloudinaryPreviewUrl: jest.fn((id: string) => `https://res.cloudinary.test/${id}`),
  createProductMedia: jest.fn(),
  setProductMediaCover: jest.fn(),
  setProductMediaClosing: jest.fn(),
  reorderProductMedia: jest.fn(),
  deleteProductMedia: jest.fn(),
  restoreProductMedia: jest.fn(),
}));
jest.mock('@/lib/gallery/api', () => ({ exchangeItem: jest.fn(), getItem: jest.fn() }));

let pickerOnSelect: ((item: GalleryItem) => void) | null = null;
jest.mock('@/components/dashboard/GalleryPickerModal', () => ({
  __esModule: true,
  default: (props: { onSelect: (item: GalleryItem) => void }) => {
    pickerOnSelect = props.onSelect;
    return null;
  },
  uploadDeviceFileToGallery: jest.fn(),
}));
jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  __esModule: true,
  useImageCrop: () => jest.fn(),
}));
jest.mock('@/components/dashboard/RetryingImage', () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: { src: string; alt?: string }) => {
    const { style, className } = rest as { style?: React.CSSProperties; className?: string };
    return <img src={src} alt={alt ?? ''} style={style} className={className} />;
  },
}));

import { createProductMedia } from '@/lib/catalog/api';
import { getItem } from '@/lib/gallery/api';
import { POLL_INITIAL_MS } from '@/lib/gallery/use-processing-poll';

const media = (id: string, over: Partial<ProductMedia> = {}): ProductMedia => ({
  id,
  cloudinaryPublicId: '',
  galleryItemId: `g-${id}`,
  variantId: null,
  role: 'CAROUSEL',
  url: `https://img.test/${id}.webp`,
  width: 400,
  height: 500,
  altText: null,
  sortOrder: 0,
  ...over,
});

/** The enlarge button wraps the tile — the tile's own box. */
function tile(id: string): HTMLElement {
  const el = document.querySelector(
    `[data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-enlarge-product-image@${id}"]`,
  );
  if (!el) throw new Error(`no tile for ${id}`);
  return el as HTMLElement;
}

function renderSection(rows: ProductMedia[], onMediaChange = jest.fn()) {
  return render(
    <MediaSection productId="p1" productName="Aventus" media={rows} onMediaChange={onMediaChange} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  pickerOnSelect = null;
});
afterEach(() => {
  jest.useRealTimers();
});

describe('MediaSection grid — photos and videos', () => {
  it('draws a photo as a photo, with no play glyph', () => {
    renderSection([media('photo', { kind: 'image', status: 'ready', posterUrl: null })]);
    const t = tile('photo');
    expect(t.querySelector('img')).toHaveAttribute('src', 'https://img.test/photo.webp');
    expect(t.querySelector('[data-media-play]')).toBeNull();
    expect(within(t).queryByText(/converting|failed/i)).toBeNull();
  });

  it('still draws a row from an older API (no kind) as a photo', () => {
    renderSection([media('legacy')]);
    expect(tile('legacy').querySelector('img')).toHaveAttribute('src', 'https://img.test/legacy.webp');
    expect(tile('legacy').querySelector('[data-media-play]')).toBeNull();
  });

  it('draws a ready video as its poster with a play glyph — never the movie in an <img>', () => {
    renderSection([
      media('clip', {
        kind: 'video',
        status: 'ready',
        url: 'https://s3.test/clip.mp4',
        posterUrl: 'https://img.test/clip-poster.webp',
      }),
    ]);
    const t = tile('clip');
    expect(t.querySelector('img')).toHaveAttribute('src', 'https://img.test/clip-poster.webp');
    expect(t.querySelector('img[src="https://s3.test/clip.mp4"]')).toBeNull();
    expect(t.querySelector('[data-media-play]')).not.toBeNull();
    expect(within(t).queryByText(/converting|failed/i)).toBeNull();
    // Says what it is to a screen reader too.
    expect(within(t).getByText(/video/i)).toBeInTheDocument();
  });

  it('draws a ready video with no poster as a first-frame <video>, not a broken image', () => {
    renderSection([
      media('noposter', { kind: 'video', status: 'ready', url: 'https://s3.test/np.mp4', posterUrl: null }),
    ]);
    const t = tile('noposter');
    expect(t.querySelector('img')).toBeNull();
    expect(t.querySelector('video')).toHaveAttribute('src', 'https://s3.test/np.mp4');
    expect(t.querySelector('[data-media-play]')).not.toBeNull();
  });

  it('draws a converting video as its poster with the Converting badge', () => {
    (getItem as jest.Mock).mockImplementation(async () => new Promise(() => {}));
    renderSection([
      media('conv', {
        kind: 'video',
        status: 'processing',
        url: 'https://img.test/conv-poster.webp',
        posterUrl: 'https://img.test/conv-poster.webp',
      }),
    ]);
    const t = tile('conv');
    expect(within(t).getByText(/converting/i)).toBeInTheDocument();
    expect(t.querySelector('video')).toBeNull();
    expect(t.querySelector('img')).toHaveAttribute('src', 'https://img.test/conv-poster.webp');
    expect(t.querySelector('[data-media-play]')).not.toBeNull();
  });

  it('shows a placeholder for a converting video with nothing to show yet', () => {
    renderSection([
      media('conv2', { kind: 'video', status: 'processing', url: null, posterUrl: null }),
    ]);
    const t = tile('conv2');
    expect(t.querySelector('img')).toBeNull();
    expect(t.querySelector('video')).toBeNull();
    expect(within(t).getByText(/preview soon/i)).toBeInTheDocument();
    expect(within(t).getByText(/converting/i)).toBeInTheDocument();
  });

  it('marks a failed video Failed', () => {
    renderSection([
      media('bad', {
        kind: 'video',
        status: 'failed',
        url: 'https://img.test/bad-poster.webp',
        posterUrl: 'https://img.test/bad-poster.webp',
      }),
    ]);
    const t = tile('bad');
    expect(within(t).getByText(/^failed$/i)).toBeInTheDocument();
    expect(t.querySelector('video')).toBeNull();
  });

  it('turns a converting tile into the ready video once the Gallery says so', async () => {
    jest.useFakeTimers();
    (getItem as jest.Mock).mockResolvedValue({
      id: 'g-conv',
      kind: 'video',
      url: 'https://s3.test/conv.mp4',
      posterUrl: 'https://img.test/conv-poster.webp',
      status: 'ready',
      processingError: null,
    });
    const onMediaChange = jest.fn();
    renderSection(
      [media('conv', { kind: 'video', status: 'processing', posterUrl: 'https://img.test/conv-poster.webp' })],
      onMediaChange,
    );
    await act(async () => {
      jest.advanceTimersByTime(POLL_INITIAL_MS);
    });
    await waitFor(() => expect(getItem).toHaveBeenCalledWith('g-conv'));
    await waitFor(() =>
      expect(onMediaChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'conv', status: 'ready', url: 'https://s3.test/conv.mp4' }),
      ]),
    );
  });

  it('asks the Gallery nothing when no video is converting', async () => {
    jest.useFakeTimers();
    renderSection([
      media('photo', { kind: 'image', status: 'ready' }),
      media('clip', { kind: 'video', status: 'ready', posterUrl: 'https://img.test/p.webp' }),
    ]);
    await act(async () => {
      jest.advanceTimersByTime(POLL_INITIAL_MS * 10);
    });
    expect(getItem).not.toHaveBeenCalled();
  });
});

describe('MediaSection — linking a video from the Gallery', () => {
  it('keeps what the picked item is when the create response does not say (older API)', async () => {
    (createProductMedia as jest.Mock).mockResolvedValue(
      media('new', { url: 'https://img.test/new-poster.webp' }),
    );
    const onMediaChange = jest.fn();
    const { getByText } = renderSection([], onMediaChange);
    act(() => {
      getByText('Choose from Gallery').click();
    });
    act(() => {
      getByText('Browse Gallery').click();
    });
    expect(pickerOnSelect).not.toBeNull();
    await act(async () => {
      pickerOnSelect!({
        id: 'g-new',
        folderId: 'f',
        kind: 'video',
        url: 'https://s3.test/new.mov',
        posterUrl: 'https://img.test/new-poster.webp',
        mimeType: 'video/quicktime',
        width: null,
        height: null,
        durationSeconds: null,
        altText: null,
        createdAt: '2026-09-13',
        status: 'processing',
        processingError: null,
      });
    });
    expect(onMediaChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'new',
        kind: 'video',
        status: 'processing',
        posterUrl: 'https://img.test/new-poster.webp',
      }),
    ]);
  });
});
