import { render } from '@testing-library/react';
import MediaSection from '@/app/dashboard/products/[slug]/edit/MediaSection';

/**
 * dashboard#45: the product media screen's two file inputs (device upload and
 * Exchange) accept every video format backend#123 converts, including the bare
 * extensions — Windows browsers often send no MIME type for .mkv/.avi.
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
jest.mock('@/lib/gallery/api', () => ({ exchangeItem: jest.fn() }));
jest.mock('@/components/dashboard/GalleryPickerModal', () => ({
  __esModule: true,
  default: () => null,
  uploadDeviceFileToGallery: jest.fn(),
}));
jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  __esModule: true,
  useImageCrop: () => jest.fn(),
}));

describe('MediaSection upload inputs', () => {
  it('accept the converted video formats on both the device and the Exchange input', () => {
    const { container } = render(
      <MediaSection productId="p1" productName="Aventus" media={[]} onMediaChange={() => {}} />,
    );
    const device = container.querySelector('[data-trace-id$="EL-INPUT-media-device-file"]');
    const exchange = container.querySelector('[data-trace-id$="EL-INPUT-media-exchange-file"]');
    for (const input of [device, exchange]) {
      expect(input).not.toBeNull();
      const accept = input!.getAttribute('accept')!.split(',');
      expect(accept).toEqual(
        expect.arrayContaining([
          'image/jpeg',
          'video/mp4',
          'video/quicktime',
          'video/webm',
          'video/x-matroska',
          'video/x-msvideo',
          '.mkv',
          '.avi',
          '.flv',
          '.3gp',
        ]),
      );
    }
  });
});
