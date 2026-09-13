import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GalleryPickerModal from '@/components/dashboard/GalleryPickerModal';
import ImageField from '@/components/dashboard/ImageField';
import type { GalleryFolder, GalleryItem } from '@/lib/gallery/types';

/**
 * dashboard#51 — a category, brand, bundle or shop-tile picture is a still
 * image: the storefront draws it into an `<img>` through imgproxy, which
 * resizes photos, not movies. Those fields open the same gallery picker as
 * product media and the hero, which DO take videos, so the picker is told.
 *
 * Decision: a video in an images-only picker is shown (the admin can still see
 * it is there, and why it is not offered) but DISABLED, with the reason as its
 * accessible description — the same pattern as a failed video (#45), rather
 * than silently filtering it out and leaving a folder looking half empty.
 */

jest.mock('@/lib/gallery/api', () => ({
  listFolders: jest.fn(),
  listItems: jest.fn(),
  getItem: jest.fn(),
  searchGallery: jest.fn(),
  uploadItem: jest.fn(),
  createFolder: jest.fn(),
  ensureProductFolder: jest.fn(),
  exchangeItem: jest.fn(),
}));
jest.mock('@/components/dashboard/ImageCropProvider', () => ({ useImageCrop: () => jest.fn() }));
jest.mock('@/components/dashboard/RetryingImage', () => ({
  __esModule: true,
  default: ({ src }: { src: string }) => <img src={src} alt="" />,
}));

import { getItem, listFolders, listItems, searchGallery } from '@/lib/gallery/api';

const top: GalleryFolder = { id: 'top', name: 'Storefront', parentId: null, itemCount: 2, createdAt: '2026-09-13' };
const leaf: GalleryFolder = { id: 'leaf', name: 'Tiles', parentId: 'top', itemCount: 2, createdAt: '2026-09-13' };

const item = (id: string, over: Partial<GalleryItem> = {}): GalleryItem => ({
  id,
  folderId: 'leaf',
  kind: 'image',
  url: `https://img.test/${id}.webp`,
  posterUrl: null,
  mimeType: 'image/webp',
  width: 480,
  height: 480,
  durationSeconds: null,
  altText: null,
  createdAt: '2026-09-13',
  status: 'ready',
  processingError: null,
  ...over,
});

const PHOTO = item('photo');
const CLIP = item('clip', {
  kind: 'video',
  url: 'https://s3.test/clip.mp4',
  posterUrl: 'https://img.test/clip-poster.webp',
  mimeType: 'video/mp4',
});

function tile(id: string, search = false): HTMLButtonElement {
  const suffix = search ? `select-search-result-item@${id}` : `select-picker-item@${id}`;
  const el = document.querySelector(`[data-trace-id$="${suffix}"]`);
  if (!el) throw new Error(`no tile ${id}`);
  return el as HTMLButtonElement;
}

beforeEach(() => {
  jest.clearAllMocks();
  (listFolders as jest.Mock).mockImplementation(async (parentId?: string) =>
    parentId === 'top' ? [leaf] : parentId ? [] : [top],
  );
  (listItems as jest.Mock).mockImplementation(async (folderId: string) =>
    folderId === 'leaf' ? [PHOTO, CLIP] : [],
  );
});

async function openLeaf(props: Partial<React.ComponentProps<typeof GalleryPickerModal>> = {}) {
  const onSelect = jest.fn();
  const user = userEvent.setup();
  render(<GalleryPickerModal onSelect={onSelect} onClose={jest.fn()} {...props} />);
  await user.click(await screen.findByRole('button', { name: /storefront/i }));
  await user.click(await screen.findByRole('button', { name: /tiles/i }));
  await waitFor(() => tile('clip'));
  return { user, onSelect };
}

describe('GalleryPickerModal imagesOnly', () => {
  it('disables a video and says why', async () => {
    const { user, onSelect } = await openLeaf({ imagesOnly: true });
    const t = tile('clip');
    expect(t).toBeDisabled();
    expect(t).toHaveAccessibleDescription(expect.stringMatching(/photos only/i));
    // Drawn as its poster, not a playing movie.
    expect(t.querySelector('video')).toBeNull();
    expect(t.querySelector('img')).toHaveAttribute('src', 'https://img.test/clip-poster.webp');
    await user.click(t);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('still lets a photo be picked', async () => {
    const { user, onSelect } = await openLeaf({ imagesOnly: true });
    expect(tile('photo')).toBeEnabled();
    await user.click(tile('photo'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'photo' }));
  });

  it('applies to search results too', async () => {
    (searchGallery as jest.Mock).mockResolvedValue({
      items: [PHOTO, CLIP].map((i) => ({ ...i, breadcrumb: ['Storefront', 'Tiles'] })),
      folders: [],
      meta: { itemsTotal: 2, foldersTotal: 0, page: 1, limit: 20 },
    });
    const user = userEvent.setup();
    render(<GalleryPickerModal imagesOnly onSelect={jest.fn()} onClose={jest.fn()} />);
    await user.type(screen.getByPlaceholderText(/search photos/i), 'tile');
    await waitFor(() => tile('clip', true));
    expect(tile('clip', true)).toBeDisabled();
    expect(tile('photo', true)).toBeEnabled();
  });

  it('leaves videos pickable where videos belong (product media, hero)', async () => {
    const { user, onSelect } = await openLeaf();
    expect(tile('clip')).toBeEnabled();
    await user.click(tile('clip'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'clip' }));
  });
});

describe('ImageField', () => {
  it('opens the picker images-only', async () => {
    const user = userEvent.setup();
    render(<ImageField imageUrl={null} mediaId={null} onChange={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /choose image/i }));
    await user.click(await screen.findByRole('button', { name: /storefront/i }));
    await user.click(await screen.findByRole('button', { name: /tiles/i }));
    await waitFor(() => tile('clip'));
    expect(tile('clip')).toBeDisabled();
    expect(tile('photo')).toBeEnabled();
  });

  it('shows a video attached before this rule as a video, and asks for a photo', async () => {
    // Existing data can predate the rule (lesson dashboard#39): a category
    // picked a clip back when the picker offered them.
    (getItem as jest.Mock).mockImplementation(async (id: string) => (id === 'clip' ? CLIP : PHOTO));
    render(
      <ImageField
        label="Image"
        imageUrl="https://img.test/imgproxy-of-an-mp4"
        mediaId="clip"
        onChange={jest.fn()}
      />,
    );
    expect(await screen.findByText(/this is a video/i)).toBeInTheDocument();
    expect(screen.getByText(/choose a photo/i)).toBeInTheDocument();
    const frame = document.querySelector('[data-media-kind="video"]') as HTMLElement;
    expect(frame).not.toBeNull();
    expect(frame.querySelector('img')).toHaveAttribute('src', 'https://img.test/clip-poster.webp');
    expect(within(frame).getByText('Video')).toBeInTheDocument();
    expect(document.querySelector('img[src="https://img.test/imgproxy-of-an-mp4"]')).toBeNull();
  });

  it('draws a photo exactly as before, with no warning', async () => {
    (getItem as jest.Mock).mockResolvedValue(PHOTO);
    render(
      <ImageField label="Image" imageUrl="https://img.test/photo.webp" mediaId="photo" onChange={jest.fn()} />,
    );
    await waitFor(() => expect(getItem).toHaveBeenCalledWith('photo'));
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://img.test/photo.webp');
    expect(screen.queryByText(/this is a video/i)).toBeNull();
  });

  it('keeps drawing the picture when the item cannot be looked up', async () => {
    // Another seller's gallery item, a network blip: the lookup is a
    // refinement, never a reason to blank a field.
    (getItem as jest.Mock).mockRejectedValue({ status: 404, message: 'Not found' });
    render(
      <ImageField label="Image" imageUrl="https://img.test/photo.webp" mediaId="other" onChange={jest.fn()} />,
    );
    await waitFor(() => expect(getItem).toHaveBeenCalledWith('other'));
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://img.test/photo.webp');
    expect(screen.queryByText(/this is a video/i)).toBeNull();
  });
});
