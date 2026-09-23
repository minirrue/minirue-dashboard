import { render, screen, waitFor } from '@testing-library/react';
import HeroEditor from '@/app/dashboard/storefront-appearance/editors/HeroEditor';
import type { HeroSection, HeroSlide } from '@/lib/api/storefront';

/**
 * A hero slide can hold a video (minirue-backend#89, slice 3).
 *
 * The gallery picker always offered videos; the hero editor's frames painted
 * every pick as a photo, so a chosen clip showed as a broken frame. The colour
 * preview did the same, and it now gets the poster instead.
 */

jest.mock('@/lib/gallery/api', () => ({ getItem: jest.fn() }));
jest.mock('@/components/dashboard/GalleryPickerModal', () => ({
  __esModule: true,
  default: () => null,
  uploadDeviceFileToGallery: jest.fn(),
}));
jest.mock('@/components/dashboard/ImageCropModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/dashboard/storefront-appearance/fields/TargetField', () => ({
  __esModule: true,
  TargetField: () => null,
  HrefTargetField: () => null,
}));
jest.mock('@/app/dashboard/storefront-appearance/editors/HeroSlideColors', () => ({
  __esModule: true,
  default: ({ imageUrl }: { imageUrl?: string }) => <div data-testid="colors-preview">{imageUrl ?? 'none'}</div>,
}));

import { getItem } from '@/lib/gallery/api';

const slide = (over: Partial<HeroSlide>): HeroSlide =>
  ({
    id: 's1',
    eyebrow: '',
    headline: 'H',
    sub: '',
    tagline: '',
    mode: 'image',
    imageGalleryItemId: null,
    mobileImageGalleryItemId: null,
    imageAlt: '',
    background: '#000',
    bottle: null,
    cap: null,
    ctaLabel: null,
    ctaTarget: { kind: 'scroll' },
    ...over,
  }) as HeroSlide;

const section = (s: HeroSlide) =>
  ({ id: 'h', type: 'hero', enabled: true, order: 0, autoplayMs: 6000, ariaLabel: '', scrollCueLabel: null, slides: [s] }) as unknown as HeroSection;

const ITEMS: Record<string, unknown> = {
  clip: { id: 'clip', kind: 'video', url: 'https://s3.test/clip.mp4', posterUrl: 'https://img.test/poster.webp', width: 1920 },
  photo: { id: 'photo', kind: 'image', url: 'https://img.test/photo.webp', posterUrl: null, width: 2560 },
};

beforeEach(() => {
  jest.clearAllMocks();
  (getItem as jest.Mock).mockImplementation(async (id: string) => ITEMS[id]);
});

describe('HeroEditor with a video', () => {
  it('previews a desktop video as a video, and gives the colour preview its poster', async () => {
    render(<HeroEditor section={section(slide({ imageGalleryItemId: 'clip' }))} onChange={() => {}} />);

    // Desktop frame, and the mobile frame falling back to the same clip.
    const videos = await screen.findAllByLabelText('Chosen video');
    expect(videos).toHaveLength(2);
    expect(videos[0]).toHaveAttribute('src', 'https://s3.test/clip.mp4');
    expect(videos[0]).toHaveAttribute('poster', 'https://img.test/poster.webp');
    expect((videos[0] as HTMLVideoElement).muted).toBe(true);

    await waitFor(() =>
      expect(screen.getByTestId('colors-preview')).toHaveTextContent('https://img.test/poster.webp'),
    );
  });

  it('shows a mobile photo crop as a photo when desktop is a video', async () => {
    render(
      <HeroEditor
        section={section(slide({ imageGalleryItemId: 'clip', mobileImageGalleryItemId: 'photo' }))}
        onChange={() => {}}
      />,
    );

    await waitFor(() => expect(getItem).toHaveBeenCalledWith('photo'));
    expect(await screen.findAllByLabelText('Chosen video')).toHaveLength(1);
  });

  it('shows a converting video as its poster with a label, never the unplayable original (dashboard#45)', async () => {
    (getItem as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      kind: 'video',
      url: 'https://s3.test/raw.avi',
      posterUrl: 'https://img.test/raw-poster.webp',
      width: 1920,
      status: 'processing',
      processingError: null,
    }));
    const { container } = render(
      <HeroEditor section={section(slide({ imageGalleryItemId: 'raw' }))} onChange={() => {}} />,
    );

    // Desktop and the mobile fallback both say so.
    expect(await screen.findAllByText(/converting/i)).toHaveLength(2);
    expect(screen.queryByLabelText('Chosen video')).not.toBeInTheDocument();
    expect(container.querySelector('video')).toBeNull();
    const posters = Array.from(container.querySelectorAll('img')).filter(
      (img) => img.getAttribute('src') === 'https://img.test/raw-poster.webp',
    );
    expect(posters.length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('img[src="https://s3.test/raw.avi"]')).toBeNull();
  });

  it('leaves a photo slide as before', async () => {
    render(<HeroEditor section={section(slide({ imageGalleryItemId: 'photo' }))} onChange={() => {}} />);

    await waitFor(() =>
      expect(screen.getByTestId('colors-preview')).toHaveTextContent('https://img.test/photo.webp'),
    );
    expect(screen.queryByLabelText('Chosen video')).not.toBeInTheDocument();
  });
});
