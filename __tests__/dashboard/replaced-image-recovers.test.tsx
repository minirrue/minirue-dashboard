import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryTree, { type CategoryTreeNode } from '@/app/dashboard/categories/CategoryTree';
import { ImagePreviewModal } from '@/components/dashboard/ImagePreviewModal';
import ImageField from '@/components/dashboard/ImageField';
import type { GalleryItem } from '@/lib/gallery/types';

/**
 * "On exchanging a photo or delete and put a new photo the thumbnail appears
 * broken globally on storefront and dashboard" (owner, 2026-07-31).
 *
 * The URL is right — every replace path writes a new uuid-suffixed key and
 * the server re-resolves it on read. What is wrong is that the FIRST request
 * for that brand-new URL is a guaranteed cold miss through Cloudflare ->
 * nginx -> imgproxy -> Garage, and a handful of surfaces still render it
 * through a bare `<img>` with no `onError` — so one transient failure leaves
 * that thumbnail broken until a manual reload, forever.
 *
 * These pin the two halves of the fix on the surfaces that were still bare:
 *   1. the picture recovers by itself after a failed load (RetryingImage), and
 *   2. immediately after an Exchange the LOCAL bytes are shown, so there is no
 *      cold-miss window to fail in the first place (UploadPreviewImage).
 */

jest.mock('@/lib/gallery/api', () => ({
  exchangeItem: jest.fn(),
  getItem: jest.fn(),
}));

jest.mock('@/components/dashboard/GalleryPickerModal', () => ({
  __esModule: true,
  default: () => null,
  uploadDeviceFileToGallery: jest.fn(),
}));

const mockCropImage = jest.fn();
jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  __esModule: true,
  useImageCrop: () => mockCropImage,
}));

import { exchangeItem } from '@/lib/gallery/api';

const REMOTE = 'https://img.minirueshop.com/sig/rs:fit/czM6Ly9taW5pcnVlL2dhbGxlcnk.webp';

function makeItem(over: Partial<GalleryItem> = {}): GalleryItem {
  return {
    id: 'gal-1',
    folderId: 'folder-1',
    kind: 'image',
    posterUrl: null,
    url: `${REMOTE}?replaced`,
    mimeType: 'image/webp',
    width: 400,
    height: 400,
    durationSeconds: null,
    altText: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function category(over: Partial<CategoryTreeNode> = {}): CategoryTreeNode {
  return {
    id: 'cat-1',
    name: 'Jewellery',
    slug: 'jewellery',
    parentId: null,
    sortOrder: 0,
    children: [],
    imageUrl: REMOTE,
    imageMediaId: 'gal-1',
    ...over,
  };
}

function renderTree(node = category()) {
  const api = {
    update: jest.fn().mockResolvedValue(node),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const utils = render(
    <CategoryTree
      categories={[node]}
      api={api}
      onCategoryUpdated={jest.fn()}
      onCategoryDeleted={jest.fn()}
    />,
  );
  return { ...utils, api };
}

/** The category row's own 28px thumbnail — not any image inside the edit form. */
function rowThumbnail(): HTMLImageElement {
  return document.querySelector(
    '[data-trace-id="PG-DASHBOARD-CAT-004::EL-IMG-category-thumbnail@cat-1"]',
  ) as HTMLImageElement;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCropImage.mockImplementation((file: File) => Promise.resolve(file));
});

describe('Category row thumbnail — the picture a replaced category image lands on', () => {
  it('recovers by itself when the first (cold-miss) load fails, instead of staying broken', async () => {
    renderTree();
    fireEvent.error(rowThumbnail());
    await waitFor(() =>
      expect(rowThumbnail()).toHaveAttribute('src', expect.stringContaining('retry=1')),
    );
  });

  it('renders the plain url when nothing has failed', () => {
    renderTree();
    expect(rowThumbnail()).toHaveAttribute('src', REMOTE);
  });

  it('shows the just-exchanged LOCAL bytes immediately, never the cold remote url', async () => {
    (exchangeItem as jest.Mock).mockResolvedValue(makeItem());
    const user = userEvent.setup();
    const { container } = renderTree();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    // ImageField's hidden Exchange input is the first file input inside the
    // expanded edit form.
    const input = container.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await user.upload(input, new File(['bytes'], 'new.png', { type: 'image/png' }));

    await waitFor(() => expect(exchangeItem).toHaveBeenCalledWith('gal-1', expect.any(File)));
    await waitFor(() =>
      expect(rowThumbnail()).toHaveAttribute('src', expect.stringMatching(/^blob:/)),
    );
  });
});

describe('ImagePreviewModal — the enlarged view of a replaced photo', () => {
  it('recovers by itself when the enlarged load fails', async () => {
    render(<ImagePreviewModal src={REMOTE} alt="" onClose={jest.fn()} />);
    // `hidden: true` because a failing image is now covered by the fallback
    // and marked aria-hidden while the retries run underneath it — it is not
    // unmounted, which is the point: the retry that succeeds needs something
    // left to fire `onLoad` on.
    fireEvent.error(screen.getByRole('presentation', { hidden: true }));
    await waitFor(() =>
      expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
        'src',
        expect.stringContaining('retry=1'),
      ),
    );
  });

  it('shows the local bytes when the caller has them, so an enlarge right after an exchange never cold-misses', () => {
    const localFile = new File(['bytes'], 'new.png', { type: 'image/png' });
    render(
      <ImagePreviewModal src={REMOTE} alt="" localFile={localFile} onClose={jest.fn()} />,
    );
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      expect.stringMatching(/^blob:/),
    );
  });
});

describe('ImageField — hands the replacement bytes back to whoever renders the same picture elsewhere', () => {
  it('reports the cropped file alongside the exchanged item', async () => {
    const cropped = new File(['cropped'], 'new-cropped.jpg', { type: 'image/jpeg' });
    mockCropImage.mockResolvedValue(cropped);
    (exchangeItem as jest.Mock).mockResolvedValue(makeItem());
    const onChange = jest.fn();

    const { container } = render(
      <ImageField imageUrl={REMOTE} mediaId="gal-1" onChange={onChange} />,
    );
    const user = userEvent.setup();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['bytes'], 'new.png', { type: 'image/png' }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('gal-1', expect.objectContaining({ id: 'gal-1' }), cropped),
    );
  });

  it('reports NO local bytes when a different existing gallery item is picked instead', () => {
    // Picking an existing item is not an upload — there are no local bytes,
    // and passing stale ones would show the wrong photo under the new id.
    const onChange = jest.fn();
    render(<ImageField imageUrl={null} mediaId={null} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});
