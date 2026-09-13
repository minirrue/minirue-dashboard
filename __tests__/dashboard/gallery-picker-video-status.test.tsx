import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GalleryPickerModal from '@/components/dashboard/GalleryPickerModal';
import type { GalleryFolder, GalleryItem } from '@/lib/gallery/types';

/**
 * dashboard#45 — what the shared gallery picker (hero, journal, product media,
 * variant photos, category/brand/bundle images) does with a video that is not
 * ready.
 *
 * Decision:
 * - `processing` stays SELECTABLE, labelled "Converting…". The storefront shows
 *   the poster until the MP4 exists (backend#123), so picking one is safe, and
 *   an admin setting up a hero while a clip converts should not have to wait.
 * - `failed` is DISABLED with the reason. It will never become playable, so
 *   picking it puts a still (or nothing) on the storefront for good. The fix is
 *   Exchange or Delete in the Gallery tab, and the tile says so.
 * - Neither renders a `<video>` of the original upload; the tile shows the poster.
 */

jest.mock('@/lib/gallery/api', () => ({
  listFolders: jest.fn(),
  listItems: jest.fn(),
  getItem: jest.fn(),
  searchGallery: jest.fn(),
  uploadItem: jest.fn(),
  createFolder: jest.fn(),
  ensureProductFolder: jest.fn(),
}));

jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  useImageCrop: () => jest.fn(),
}));

jest.mock('@/components/dashboard/RetryingImage', () => ({
  __esModule: true,
  default: ({ src }: { src: string }) => <img src={src} alt="" />,
}));

import { getItem, listFolders, listItems, searchGallery } from '@/lib/gallery/api';

const top: GalleryFolder = { id: 'top', name: 'Storefront', parentId: null, itemCount: 3, createdAt: '2026-09-13' };
const leaf: GalleryFolder = { id: 'leaf', name: 'Hero clips', parentId: 'top', itemCount: 3, createdAt: '2026-09-13' };

const video = (id: string, over: Partial<GalleryItem> = {}): GalleryItem => ({
  id,
  folderId: 'leaf',
  kind: 'video',
  url: `https://s3.test/${id}.mov`,
  posterUrl: `https://img.test/${id}-poster.webp`,
  mimeType: 'video/quicktime',
  width: 1920,
  height: 1080,
  durationSeconds: 10,
  altText: null,
  createdAt: '2026-09-13',
  status: 'ready',
  processingError: null,
  ...over,
});

const REASON = 'This file has no video stream.';
const ITEMS = [
  video('ok'),
  video('proc', { status: 'processing' }),
  video('bad', { status: 'failed', processingError: REASON }),
];

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
  (listItems as jest.Mock).mockImplementation(async (folderId: string) => (folderId === 'leaf' ? ITEMS : []));
  (getItem as jest.Mock).mockImplementation(async (id: string) => ITEMS.find((i) => i.id === id));
});

async function openLeaf(onSelect = jest.fn()) {
  const user = userEvent.setup();
  render(<GalleryPickerModal onSelect={onSelect} onClose={jest.fn()} />);
  await user.click(await screen.findByRole('button', { name: /storefront/i }));
  await user.click(await screen.findByRole('button', { name: /hero clips/i }));
  await waitFor(() => expect(listItems).toHaveBeenCalledWith('leaf'));
  await waitFor(() => tile('ok'));
  return { user, onSelect };
}

describe('GalleryPickerModal — videos that are not ready', () => {
  it('lets a converting video be picked, labelled, showing its poster instead of the original', async () => {
    const { user, onSelect } = await openLeaf();
    const t = tile('proc');
    expect(within(t).getByText(/converting/i)).toBeInTheDocument();
    expect(t.querySelector('video')).toBeNull();
    expect(t.querySelector('img')).toHaveAttribute('src', 'https://img.test/proc-poster.webp');
    expect(t).toBeEnabled();

    await user.click(t);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'proc', status: 'processing' }));
  });

  it('disables a failed video and says why', async () => {
    const { user, onSelect } = await openLeaf();
    const t = tile('bad');
    expect(t).toBeDisabled();
    expect(within(t).getByText(/^failed$/i)).toBeInTheDocument();
    expect(t).toHaveAccessibleDescription(expect.stringContaining(REASON));
    expect(t).toHaveAccessibleDescription(expect.stringMatching(/exchange or delete it in the gallery/i));
    expect(t.querySelector('video')).toBeNull();

    await user.click(t);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('leaves a ready video selectable, unlabelled, as a video', async () => {
    const { user, onSelect } = await openLeaf();
    const t = tile('ok');
    expect(t.querySelector('video')).toHaveAttribute('src', 'https://s3.test/ok.mov');
    expect(within(t).queryByText(/converting|failed/i)).toBeNull();
    await user.click(t);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'ok' }));
  });

  it('applies the same rules to search results', async () => {
    (searchGallery as jest.Mock).mockResolvedValue({
      items: ITEMS.map((i) => ({ ...i, breadcrumb: ['Storefront', 'Hero clips'] })),
      folders: [],
      meta: { itemsTotal: 3, foldersTotal: 0, page: 1, limit: 20 },
    });
    const user = userEvent.setup();
    render(<GalleryPickerModal onSelect={jest.fn()} onClose={jest.fn()} />);
    await user.type(screen.getByPlaceholderText(/search photos/i), 'clip');
    await waitFor(() => tile('ok', true));
    expect(within(tile('proc', true)).getByText(/converting/i)).toBeInTheDocument();
    expect(tile('proc', true)).toBeEnabled();
    expect(tile('proc', true).querySelector('video')).toBeNull();
    expect(tile('bad', true)).toBeDisabled();
  });
});
