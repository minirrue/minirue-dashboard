import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MediaSection from '@/app/dashboard/products/[slug]/edit/MediaSection';
import type { ProductMedia } from '@/lib/catalog/types';

/**
 * Owner ask, 2026-07-31: "ensure product section in collab and admin have
 * direct delete button per photo in product new". The per-photo delete
 * button already exists on MediaSection — the ONE component both the admin
 * and collab NEW and EDIT product screens render — so it is already on the
 * new form by construction. What was missing was cover promotion after a
 * delete: the product must never be left with no cover while it still has
 * other photos.
 *
 * By the time this component ever mounts on the new-product screen, the
 * product has already been created (both new-product clients only render
 * MediaSection after createProduct/apiCollabCreateProduct resolves) — so
 * every row here is a real, already-persisted media_assets row, never a
 * client-only staged file. Delete always goes through the server soft
 * delete; there is no "staged, drop it locally" case in this codebase.
 */

jest.mock('@/lib/catalog/api', () => ({
  cloudinaryPreviewUrl: jest.fn(() => ''),
  createProductMedia: jest.fn(),
  setProductMediaCover: jest.fn(),
  setProductMediaClosing: jest.fn(),
  reorderProductMedia: jest.fn(),
  deleteProductMedia: jest.fn(),
  restoreProductMedia: jest.fn(),
}));

jest.mock('@/lib/gallery/api', () => ({
  exchangeItem: jest.fn(),
}));

// GalleryPickerModal pulls in a real network call on mount — stubbed out,
// same pattern as image-field-exchange.test.tsx.
jest.mock('@/components/dashboard/GalleryPickerModal', () => ({
  __esModule: true,
  default: () => null,
  uploadDeviceFileToGallery: jest.fn(),
}));

jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  __esModule: true,
  useImageCrop: () => jest.fn(),
}));

import { deleteProductMedia } from '@/lib/catalog/api';

function makeMedia(over: Partial<ProductMedia> = {}): ProductMedia {
  return {
    id: 'media-1',
    cloudinaryPublicId: '',
    galleryItemId: 'gallery-1',
    variantId: null,
    role: 'CAROUSEL',
    url: 'https://storage.example/photo.webp',
    width: 400,
    height: 500,
    altText: null,
    sortOrder: 0,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
});

describe('MediaSection — per-photo delete (new and edit forms alike)', () => {
  it('offers a Delete button on every photo, including on the two-step new-product "Add images" flow', () => {
    const media = [
      makeMedia({ id: 'cover-1', role: 'COVER' }),
      makeMedia({ id: 'carousel-1', role: 'CAROUSEL' }),
    ];
    render(
      <MediaSection
        productId="product-1"
        productName="Nuit Santal"
        media={media}
        onMediaChange={jest.fn()}
      />,
    );
    expect(screen.getAllByRole('button', { name: /delete image/i })).toHaveLength(2);
  });

  it('deleting a photo calls the server soft delete and removes it from the list', async () => {
    (deleteProductMedia as jest.Mock).mockResolvedValue({ promotedCoverId: null });
    const media = [
      makeMedia({ id: 'cover-1', role: 'COVER' }),
      makeMedia({ id: 'carousel-1', role: 'CAROUSEL' }),
    ];
    const onMediaChange = jest.fn();
    render(
      <MediaSection
        productId="product-1"
        productName="Nuit Santal"
        media={media}
        onMediaChange={onMediaChange}
        mediaBasePath="/collab"
      />,
    );

    const user = userEvent.setup();
    const deleteButtons = screen.getAllByRole('button', { name: /delete image/i });
    await user.click(deleteButtons[1]); // the CAROUSEL photo, not the cover

    await waitFor(() =>
      expect(deleteProductMedia).toHaveBeenCalledWith('product-1', 'carousel-1', '/collab'),
    );
    expect(onMediaChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'cover-1' }),
    ]);
  });

  it('deleting the cover promotes the server-chosen replacement to COVER in the local list', async () => {
    (deleteProductMedia as jest.Mock).mockResolvedValue({ promotedCoverId: 'carousel-1' });
    const media = [
      makeMedia({ id: 'cover-1', role: 'COVER' }),
      makeMedia({ id: 'carousel-1', role: 'CAROUSEL' }),
    ];
    const onMediaChange = jest.fn();
    render(
      <MediaSection
        productId="product-1"
        productName="Nuit Santal"
        media={media}
        onMediaChange={onMediaChange}
      />,
    );

    const user = userEvent.setup();
    const deleteButtons = screen.getAllByRole('button', { name: /delete image/i });
    await user.click(deleteButtons[0]); // the cover

    await waitFor(() =>
      expect(deleteProductMedia).toHaveBeenCalledWith('product-1', 'cover-1', '/catalog/admin'),
    );
    expect(onMediaChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'carousel-1', role: 'COVER' }),
    ]);
  });

  it('does nothing if the confirm dialog is dismissed', async () => {
    window.confirm = jest.fn(() => false);
    const media = [makeMedia({ id: 'cover-1', role: 'COVER' })];
    const onMediaChange = jest.fn();
    render(
      <MediaSection
        productId="product-1"
        productName="Nuit Santal"
        media={media}
        onMediaChange={onMediaChange}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete image/i }));

    expect(deleteProductMedia).not.toHaveBeenCalled();
    expect(onMediaChange).not.toHaveBeenCalled();
  });
});
