import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import MediaField, {
  MEDIA_UPLOAD_ACCEPT,
  canPaintLocalBytes,
  type MediaSlotSpec,
} from '@/components/storefront-appearance/MediaField';
import { heroImageWarning } from '@/lib/storefront/hero-image-guidance';
import type { GalleryItem } from '@/lib/gallery/types';

/**
 * MediaField — the single media control for Storefront Appearance (#102).
 *
 * These tests are written against the rules the component exists to hold, not
 * against its markup. Each block names the bug it is standing guard over, so
 * a future change that reintroduces one fails here with an explanation.
 */

jest.mock('@/lib/gallery/api', () => ({ getItem: jest.fn() }));

jest.mock('@/components/dashboard/GalleryPickerModal', () => ({
  __esModule: true,
  default: () => null,
  uploadDeviceFileToGallery: jest.fn(),
}));

/**
 * The crop step, stubbed as the provider behaves: it resolves to the file it
 * was handed. Tests read `cropCalls` to assert which aspect each slot asked
 * for, and `cropResult` to make a crop cancel.
 */
const cropCalls: Array<{ file: File; aspect?: number; title?: string }> = [];
let cropResult: (file: File, index: number) => File | null = (file) => file;

jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
  useImageCrop:
    () =>
    (file: File, request?: { initialAspect?: number; title?: string }) => {
      const index = cropCalls.length;
      cropCalls.push({ file, aspect: request?.initialAspect, title: request?.title });
      return Promise.resolve(cropResult(file, index));
    },
}));

import { getItem } from '@/lib/gallery/api';
import { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';

const galleryItem = (over: Partial<GalleryItem> & { id: string }): GalleryItem => ({
  folderId: 'f1',
  kind: 'image',
  url: 'https://img.test/photo.webp',
  posterUrl: null,
  mimeType: 'image/webp',
  width: null,
  height: null,
  durationSeconds: null,
  altText: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

/** A controlled host, so an `onChange` actually moves the field. */
function Harness({
  initial = {},
  slots,
  ...rest
}: {
  initial?: Record<string, string | null>;
  slots: Array<Omit<MediaSlotSpec, 'value' | 'onChange'>>;
  label?: string;
  emptyFill?: string;
  chainedUpload?: boolean;
}) {
  const [values, setValues] = React.useState<Record<string, string | null>>(initial);
  return (
    <>
      <MediaField
        label="Photograph or video"
        {...rest}
        slots={slots.map((s) => ({
          ...s,
          value: values[s.key] ?? null,
          onChange: (id) => setValues((v) => ({ ...v, [s.key]: id })),
        }))}
      />
      <span data-testid="values">{JSON.stringify(values)}</span>
    </>
  );
}

const oneSlot = [{ key: 'image', label: 'Photo' }];
const heroSlots = [
  {
    key: 'desktop',
    label: 'Desktop (landscape)',
    aspect: 16 / 9,
    sizeAdvisory: (w: number) => heroImageWarning(w, 'desktop'),
  },
  {
    key: 'mobile',
    label: 'Mobile (portrait)',
    aspect: 3 / 4,
    fallbackToKey: 'desktop',
    fallbackNote: 'Falls back to the desktop image on phones.',
    sizeAdvisory: (w: number) => heroImageWarning(w, 'mobile'),
  },
];

/**
 * The preview `<img>` is `alt=""` — presentational, so it has no `img` role
 * and has to be found in the DOM rather than by role.
 */
async function waitForImage(container: HTMLElement): Promise<HTMLImageElement> {
  let img: HTMLImageElement | null = null;
  await waitFor(() => {
    img = container.querySelector('img');
    expect(img).not.toBeNull();
  });
  // UploadPreviewImage mints its object URL in an effect, so the first paint
  // is always the remote src. Flush effects before reading which one won,
  // otherwise this asserts on a frame that has not decided yet.
  await act(async () => {});
  return container.querySelector('img') as HTMLImageElement;
}

/** Hand a file to the hidden input the way a file dialog would. */
function chooseFile(file: File) {
  const input = screen.getByTestId('media-field-file-input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

beforeEach(() => {
  jest.clearAllMocks();
  cropCalls.length = 0;
  cropResult = (file) => file;
  (getItem as jest.Mock).mockResolvedValue(galleryItem({ id: 'unused' }));
});

/* ------------------------------------------------------------------ */
/* Video is not an image (lib/gallery/types.ts:9-14)                   */
/* ------------------------------------------------------------------ */

describe('a picked gallery video', () => {
  it('shows a player once the conversion is ready', async () => {
    (getItem as jest.Mock).mockResolvedValue(
      galleryItem({
        id: 'clip',
        kind: 'video',
        url: 'https://s3.test/clip.mp4',
        posterUrl: 'https://img.test/poster.webp',
        status: 'ready',
      }),
    );

    render(<Harness initial={{ image: 'clip' }} slots={oneSlot} />);

    const video = await screen.findByLabelText('Chosen video');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('src', 'https://s3.test/clip.mp4');
    expect(video).toHaveAttribute('poster', 'https://img.test/poster.webp');
  });

  it('shows the poster while converting, and never a <video src={url}> of the original', async () => {
    // `url` here is the ORIGINAL upload — an MKV no browser is obliged to
    // decode. Painting it as a video element is the black box that reads as a
    // failed upload, which is the whole reason backend#89 exists.
    (getItem as jest.Mock).mockResolvedValue(
      galleryItem({
        id: 'raw',
        kind: 'video',
        url: 'https://s3.test/raw.mkv',
        posterUrl: 'https://img.test/raw-poster.webp',
        status: 'processing',
      }),
    );

    const { container } = render(<Harness initial={{ image: 'raw' }} slots={oneSlot} />);

    expect(await screen.findAllByText(/converting/i)).not.toHaveLength(0);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://img.test/raw-poster.webp',
    );
    expect(container.innerHTML).not.toContain('raw.mkv');
  });

  it('explains a failed conversion as an error, not as a quiet consequence', async () => {
    (getItem as jest.Mock).mockResolvedValue(
      galleryItem({
        id: 'bad',
        kind: 'video',
        url: 'https://s3.test/bad.mkv',
        posterUrl: null,
        status: 'failed',
        processingError: 'This file has no video stream.',
      }),
    );

    const { container } = render(<Harness initial={{ image: 'bad' }} slots={oneSlot} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This file has no video stream.');
    expect(container.querySelector('video')).toBeNull();
  });

  it('does not repeat the status line on a frame that is only standing in', async () => {
    (getItem as jest.Mock).mockResolvedValue(
      galleryItem({
        id: 'raw',
        kind: 'video',
        url: 'https://s3.test/raw.mkv',
        posterUrl: 'https://img.test/raw-poster.webp',
        status: 'processing',
      }),
    );

    render(<Harness initial={{ desktop: 'raw', mobile: null }} slots={heroSlots} />);

    // Both frames paint the clip (mobile falls back to desktop), but only the
    // slot that actually owns it says anything about the conversion.
    await screen.findByText(/until the video has been converted/i);
    expect(screen.getAllByText(/until the video has been converted/i)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* HEIC — accept it, do not paint bytes the browser cannot decode      */
/* ------------------------------------------------------------------ */

describe('local-bytes preview policy', () => {
  it('offers HEIC in the file dialog at all', () => {
    // A MIME-only accept list hides .heic on Windows, where the file arrives
    // with an empty `type` because there is no registry MIME for it.
    expect(MEDIA_UPLOAD_ACCEPT).toContain('.heic');
    expect(MEDIA_UPLOAD_ACCEPT).toContain('.heif');
  });

  it.each([
    ['an empty type, as Windows reports a .heic', ''],
    ['image/heic, as the browsers that do name it report it', 'image/heic'],
    ['image/heif', 'image/heif'],
  ])('does not paint local bytes for %s', async (_why, type) => {
    (uploadDeviceFileToGallery as jest.Mock).mockResolvedValue(
      galleryItem({ id: 'heic-1', url: 'https://img.test/converted.webp' }),
    );

    const { container } = render(<Harness slots={oneSlot} />);
    fireEvent.click(screen.getByRole('button', { name: /upload from this device/i }));
    chooseFile(new File(['xx'], 'holiday.heic', { type }));

    const img = await waitForImage(container);
    // The remote WebP the server just wrote, not a blob: URL of bytes no
    // browser can decode — which would be a broken frame in the one place the
    // remote copy renders fine.
    expect(img).toHaveAttribute('src', 'https://img.test/converted.webp');
    expect(img.getAttribute('src')).not.toMatch(/^blob:/);
  });

  it('does paint local bytes for a JPEG, which is the point of having them', async () => {
    (uploadDeviceFileToGallery as jest.Mock).mockResolvedValue(
      galleryItem({ id: 'jpg-1', url: 'https://img.test/cold-miss.webp' }),
    );

    const { container } = render(<Harness slots={oneSlot} />);
    fireEvent.click(screen.getByRole('button', { name: /upload from this device/i }));
    chooseFile(new File(['xx'], 'holiday.jpg', { type: 'image/jpeg' }));

    const img = await waitForImage(container);
    expect(img.getAttribute('src')).toMatch(/^blob:/);
  });

  it('classifies by allowlist, because image/heic passes a startsWith test', () => {
    expect(canPaintLocalBytes(new File([''], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(canPaintLocalBytes(new File([''], 'a.png', { type: 'image/PNG' }))).toBe(true);
    expect(canPaintLocalBytes(new File([''], 'a.heic', { type: 'image/heic' }))).toBe(false);
    expect(canPaintLocalBytes(new File([''], 'a.heic', { type: '' }))).toBe(false);
    expect(canPaintLocalBytes(null)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* The chained dual-aspect crop (HeroEditor.tsx:292-296)               */
/* ------------------------------------------------------------------ */

describe('one photo, cropped for every slot', () => {
  it('produces two gallery items from one chosen file', async () => {
    (uploadDeviceFileToGallery as jest.Mock)
      .mockResolvedValueOnce(galleryItem({ id: 'wide', url: 'https://img.test/wide.webp' }))
      .mockResolvedValueOnce(galleryItem({ id: 'tall', url: 'https://img.test/tall.webp' }));

    render(<Harness slots={heroSlots} />);

    fireEvent.click(screen.getByRole('button', { name: /upload one photo/i }));
    chooseFile(new File(['xx'], 'autumn.jpg', { type: 'image/jpeg' }));

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('values').textContent || '{}')).toEqual({
        desktop: 'wide',
        mobile: 'tall',
      }),
    );

    // Cropped twice, at each slot's own aspect, from the same source file.
    expect(cropCalls).toHaveLength(2);
    expect(cropCalls[0].aspect).toBeCloseTo(16 / 9);
    expect(cropCalls[1].aspect).toBeCloseTo(3 / 4);
    expect(cropCalls[0].file).toBe(cropCalls[1].file);

    // Two distinct uploads, each named after the slot it was cropped for.
    expect(uploadDeviceFileToGallery).toHaveBeenCalledTimes(2);
    const names = (uploadDeviceFileToGallery as jest.Mock).mock.calls.map(
      (c) => (c[0] as File).name,
    );
    expect(names).toEqual(['autumn-desktop.jpg', 'autumn-mobile.jpg']);
  });

  it('keeps the first crop when the second is cancelled', async () => {
    (uploadDeviceFileToGallery as jest.Mock).mockResolvedValue(
      galleryItem({ id: 'wide', url: 'https://img.test/wide.webp' }),
    );
    cropResult = (file, index) => (index === 0 ? file : null);

    render(<Harness slots={heroSlots} />);
    fireEvent.click(screen.getByRole('button', { name: /upload one photo/i }));
    chooseFile(new File(['xx'], 'autumn.jpg', { type: 'image/jpeg' }));

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('values').textContent || '{}')).toEqual({
        desktop: 'wide',
      }),
    );
    expect(uploadDeviceFileToGallery).toHaveBeenCalledTimes(1);
  });

  it('is not offered for a single-slot field', () => {
    render(<Harness slots={oneSlot} />);
    expect(screen.queryByRole('button', { name: /upload one photo/i })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Upload folder naming (decision 1)                                   */
/* ------------------------------------------------------------------ */

describe('upload folder naming', () => {
  it('uses one stable bucket, never merchant-editable prose', async () => {
    (uploadDeviceFileToGallery as jest.Mock).mockResolvedValue(galleryItem({ id: 'u1' }));

    render(<Harness slots={oneSlot} />);
    fireEvent.click(screen.getByRole('button', { name: /upload from this device/i }));
    chooseFile(new File(['xx'], 'a.jpg', { type: 'image/jpeg' }));

    await waitFor(() => expect(uploadDeviceFileToGallery).toHaveBeenCalled());
    expect((uploadDeviceFileToGallery as jest.Mock).mock.calls[0][1]).toBe('Storefront');
  });
});

/* ------------------------------------------------------------------ */
/* The size advisory (lib/storefront/hero-image-guidance.ts)           */
/* ------------------------------------------------------------------ */

describe('the size advisory', () => {
  it('stays quiet on an unknown width, and never even asks the advisor', async () => {
    // `gallery_items.width` is nullable — null for anything uploaded before
    // the column existed. Treating that as "too small" would flag a library
    // of possibly-fine images and teach everyone to ignore the badge.
    const advisor = jest.fn(() => ({ message: 'should never be said' }));
    (getItem as jest.Mock).mockResolvedValue(
      galleryItem({ id: 'old', url: 'https://img.test/old.webp', width: null }),
    );

    render(
      <Harness
        initial={{ image: 'old' }}
        slots={[{ key: 'image', label: 'Photo', aspect: 16 / 9, sizeAdvisory: advisor }]}
      />,
    );

    await waitFor(() => expect(getItem).toHaveBeenCalledWith('old'));
    await waitFor(() =>
      expect(screen.getByTestId('media-field-file-input')).toBeInTheDocument(),
    );
    expect(advisor).not.toHaveBeenCalled();
    expect(screen.queryByText('should never be said')).toBeNull();
  });

  it('is advisory only — it warns about a small source without blocking it', async () => {
    (getItem as jest.Mock).mockResolvedValue(
      galleryItem({ id: 'small', url: 'https://img.test/small.webp', width: 340 }),
    );

    render(<Harness initial={{ desktop: 'small', mobile: null }} slots={heroSlots} />);

    const advisory = await screen.findByText(/340px wide/);
    // role="status", not alert: advice interrupts nobody and blocks no save.
    expect(advisory.closest('[role="status"]')).not.toBeNull();
    screen.getAllByRole('button', { name: /^gallery$/i }).forEach((b) => expect(b).toBeEnabled());
  });

  it('does not warn on the slot that is only standing in for another', async () => {
    (getItem as jest.Mock).mockResolvedValue(
      galleryItem({ id: 'small', url: 'https://img.test/small.webp', width: 340 }),
    );

    render(<Harness initial={{ desktop: 'small', mobile: null }} slots={heroSlots} />);

    await screen.findByText(/340px wide/);
    // Once, for desktop. The mobile frame is showing the desktop image, and
    // saying it twice would read as two separate problems.
    expect(screen.getAllByText(/will be stretched about/)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* Clearing                                                            */
/* ------------------------------------------------------------------ */

describe('clearing a slot', () => {
  it('drops the id and the frame with it', async () => {
    (getItem as jest.Mock).mockResolvedValue(
      galleryItem({ id: 'photo', url: 'https://img.test/photo.webp' }),
    );

    const { container } = render(<Harness initial={{ image: 'photo' }} slots={oneSlot} />);
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('values').textContent || '{}')).toEqual({
        image: null,
      }),
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('offers no Clear on a slot that holds nothing', () => {
    render(<Harness slots={oneSlot} />);
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });
});
