import { render, screen, waitFor } from '@testing-library/react';
import JournalEditor from '@/app/dashboard/storefront-appearance/editors/JournalEditor';
import type { JournalSection } from '@/lib/api/storefront';

/**
 * A journal block can hold a video (minirue-backend#89).
 *
 * The gallery picker always offered videos; this editor's preview tile painted
 * every pick as a photo, so a chosen clip showed as a broken frame that reads as
 * a failed upload.
 */

jest.mock('@/lib/gallery/api', () => ({ getItem: jest.fn() }));
jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  __esModule: true,
  useImageCrop: () => jest.fn(),
}));
jest.mock('@/components/dashboard/GalleryPickerModal', () => ({
  __esModule: true,
  default: () => null,
  uploadDeviceFileToGallery: jest.fn(),
}));
jest.mock('@/app/dashboard/storefront-appearance/pickers/EntityPicker', () => ({
  __esModule: true,
  default: () => null,
}));

import { getItem } from '@/lib/gallery/api';

const section = (imageGalleryItemId: string | null) =>
  ({
    id: 'j1',
    type: 'journal',
    enabled: true,
    order: 1,
    mode: 'editorial',
    eyebrow: 'Journal',
    title: 'The making of',
    body: 'Words',
    imageGalleryItemId,
    ctaLabel: null,
    ctaHref: null,
    productId: null,
    imageSide: 'left',
    badge: null,
  }) as unknown as JournalSection;

const item = (over: Record<string, unknown>) => ({
  id: 'x',
  folderId: 'f',
  kind: 'image',
  url: 'https://img.test/photo.webp',
  posterUrl: null,
  mimeType: 'image/webp',
  width: 1,
  height: 1,
  durationSeconds: null,
  altText: null,
  createdAt: new Date().toISOString(),
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('JournalEditor preview tile', () => {
  it('previews a chosen video as a video, with its poster', async () => {
    (getItem as jest.Mock).mockResolvedValue(
      item({ id: 'clip', kind: 'video', url: 'https://s3.test/clip.mp4', posterUrl: 'https://img.test/p.webp' }),
    );
    render(<JournalEditor section={section('clip')} onChange={() => {}} />);

    const video = await screen.findByLabelText('Chosen video');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('src', 'https://s3.test/clip.mp4');
    expect(video).toHaveAttribute('poster', 'https://img.test/p.webp');
    // A thumbnail, not a player shouting at the admin.
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video).not.toHaveAttribute('controls');
  });

  it('previews a photo exactly as before', async () => {
    (getItem as jest.Mock).mockResolvedValue(item({ id: 'photo' }));
    render(<JournalEditor section={section('photo')} onChange={() => {}} />);

    await waitFor(() => expect(getItem).toHaveBeenCalledWith('photo'));
    expect(screen.queryByLabelText('Chosen video')).not.toBeInTheDocument();
  });

  it('tells the admin where videos come from', () => {
    render(<JournalEditor section={section(null)} onChange={() => {}} />);

    expect(screen.getByText(/Videos are added from the Gallery/)).toBeInTheDocument();
  });
});
