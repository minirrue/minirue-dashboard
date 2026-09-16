import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GalleryClient from '@/app/dashboard/gallery/GalleryClient';
import type { GalleryFolder, GalleryItem } from '@/lib/gallery/types';

/**
 * dashboard#45 — the Gallery tab after backend#89 slice 1.
 *
 * The backend takes ProRes/HEVC .mov, .avi, .mkv, .webm and friends and turns
 * them into H.264 MP4 in the background. Until it has, `url` is the ORIGINAL
 * upload, which a browser may not play — so the tile shows the poster and says
 * "Converting…", and switches to the playable video on its own.
 */

jest.mock('@/lib/gallery/api', () => ({
  listFolders: jest.fn(),
  listItems: jest.fn(),
  getItem: jest.fn(),
  createFolder: jest.fn(),
  deleteFolder: jest.fn(),
  renameFolder: jest.fn(),
  deleteItem: jest.fn(),
  exchangeItem: jest.fn(),
  searchGallery: jest.fn(),
  updateItemAltText: jest.fn(),
  uploadItem: jest.fn(),
}));

jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  __esModule: true,
  useImageCrop: () => (file: File) => Promise.resolve(file),
}));

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: { role: 'ADMIN' } }),
}));

jest.mock('@/components/dashboard/RetryingImage', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt ?? ''} />,
}));

import { getItem, listFolders, listItems, searchGallery } from '@/lib/gallery/api';
import { POLL_INITIAL_MS } from '@/lib/gallery/use-processing-poll';

const leaf: GalleryFolder = {
  id: 'folder-leaf',
  name: 'Aventus',
  parentId: 'folder-top',
  itemCount: 3,
  createdAt: '2026-09-13T00:00:00.000Z',
};

const video = (id: string, over: Partial<GalleryItem> = {}): GalleryItem => ({
  id,
  folderId: 'folder-leaf',
  kind: 'video',
  url: `https://s3.test/${id}.mov`,
  posterUrl: `https://img.test/${id}-poster.webp`,
  mimeType: 'video/quicktime',
  width: 1920,
  height: 1080,
  durationSeconds: 12,
  altText: id,
  createdAt: '2026-09-13T00:00:00.000Z',
  status: 'ready',
  processingError: null,
  ...over,
});

function card(id: string): HTMLElement {
  const el = document.querySelector(`[data-trace-id$="EL-CARD-gallery-item@${id}"]`);
  if (!el) throw new Error(`no card for ${id}`);
  return el as HTMLElement;
}

async function openLeaf() {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<GalleryClient />);
  await user.click(await screen.findByRole('treeitem', { name: /aventus/i }));
  await waitFor(() => expect(listItems).toHaveBeenCalled());
  await screen.findByText(/drag photos or videos here/i);
  await waitFor(() => expect(screen.queryByText(/loading items/i)).toBeNull());
  return user;
}

beforeEach(() => {
  jest.clearAllMocks();
  (listFolders as jest.Mock).mockImplementation(async (parentId?: string) =>
    parentId ? [] : [leaf],
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Gallery upload inputs accept every format the backend converts', () => {
  it('lists the new video types AND their extensions on the dropzone and the Exchange input', async () => {
    (listItems as jest.Mock).mockResolvedValue([video('ready-1')]);
    await openLeaf();

    const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const dropzone = inputs.find((i) => i.dataset.traceId?.endsWith('gallery-upload-file'));
    const exchange = inputs.find((i) => i.dataset.traceId?.endsWith('gallery-item-exchange-file'));
    for (const input of [dropzone, exchange]) {
      expect(input).toBeDefined();
      const accept = input!.getAttribute('accept')!.split(',');
      // Images still accepted.
      expect(accept).toEqual(expect.arrayContaining(['image/jpeg', 'image/heic', 'video/mp4', 'video/quicktime']));
      // Windows browsers often send no MIME type for mkv/avi — the extension is what lets them be picked.
      expect(accept).toEqual(
        expect.arrayContaining([
          'video/webm',
          'video/x-matroska',
          'video/x-msvideo',
          'video/ogg',
          'video/mpeg',
          'video/mp2t',
          'video/3gpp',
          '.mkv',
          '.avi',
          '.webm',
          '.ts',
          '.3gp',
          '.ogv',
          '.flv',
          '.mpg',
        ]),
      );
    }
  });

  it('tells the admin videos are converted, and the limits', async () => {
    (listItems as jest.Mock).mockResolvedValue([]);
    await openLeaf();
    expect(screen.getByText(/converted to MP4 after upload/i)).toHaveTextContent(/50 MB/);
    expect(screen.getByText(/converted to MP4 after upload/i)).toHaveTextContent(/120 seconds/);
  });
});

describe('Gallery tile for a video that is converting or failed', () => {
  it('shows the poster and a Converting badge — never a <video> of the unplayable original', async () => {
    (listItems as jest.Mock).mockResolvedValue([video('proc', { status: 'processing' })]);
    (getItem as jest.Mock).mockImplementation(async (id: string) => video(id, { status: 'processing' }));
    await openLeaf();

    const tile = card('proc');
    expect(within(tile).getByText(/converting/i)).toBeInTheDocument();
    expect(tile.querySelector('video')).toBeNull();
    expect(tile.querySelector('img')).toHaveAttribute('src', 'https://img.test/proc-poster.webp');
  });

  it('shows a placeholder, not a broken frame, for a converting video with no poster yet', async () => {
    (listItems as jest.Mock).mockResolvedValue([video('proc', { status: 'processing', posterUrl: null })]);
    (getItem as jest.Mock).mockImplementation(async (id: string) => video(id, { status: 'processing', posterUrl: null }));
    await openLeaf();

    const tile = card('proc');
    expect(tile.querySelector('video')).toBeNull();
    expect(tile.querySelector('img')).toBeNull();
    expect(within(tile).getByText(/converting/i)).toBeInTheDocument();
  });

  it('shows a Failed badge, the reason, and still offers Exchange and Delete', async () => {
    const reason = 'This video is 400 seconds long. The limit is 120 seconds — trim it and upload again.';
    (listItems as jest.Mock).mockResolvedValue([
      video('bad', { status: 'failed', processingError: reason }),
    ]);
    await openLeaf();

    const tile = card('bad');
    expect(within(tile).getByText(/^failed$/i)).toBeInTheDocument();
    expect(within(tile).getByText(reason)).toBeInTheDocument();
    expect(tile.querySelector('video')).toBeNull();
    expect(within(tile).getByRole('button', { name: /exchange/i })).toBeEnabled();
    expect(within(tile).getByRole('button', { name: /delete/i })).toBeEnabled();
    // A failed item is final — nothing to wait for.
    expect(getItem).not.toHaveBeenCalled();
  });

  it('renders a ready video as a video, exactly as before', async () => {
    (listItems as jest.Mock).mockResolvedValue([video('ok')]);
    await openLeaf();
    const tile = card('ok');
    expect(tile.querySelector('video')).toHaveAttribute('src', 'https://s3.test/ok.mov');
    expect(within(tile).queryByText(/converting|failed/i)).toBeNull();
  });

  it('switches a converting tile to the playable MP4 without a reload', async () => {
    jest.useFakeTimers();
    (listItems as jest.Mock).mockResolvedValue([video('proc', { status: 'processing' })]);
    (getItem as jest.Mock).mockResolvedValue(
      video('proc', { status: 'ready', url: 'https://s3.test/proc.mp4', mimeType: 'video/mp4' }),
    );
    await openLeaf();
    expect(card('proc').querySelector('video')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(POLL_INITIAL_MS);
    });

    await waitFor(() =>
      expect(card('proc').querySelector('video')).toHaveAttribute('src', 'https://s3.test/proc.mp4'),
    );
    expect(within(card('proc')).queryByText(/converting/i)).toBeNull();
    expect(getItem).toHaveBeenCalledWith('proc');
    // The list was refreshed in place, not refetched.
    expect(listItems).toHaveBeenCalledTimes(1);
  });

  it('does not open a player for a converting video in the full-size preview', async () => {
    (listItems as jest.Mock).mockResolvedValue([video('proc', { status: 'processing' })]);
    (getItem as jest.Mock).mockImplementation(async (id: string) => video(id, { status: 'processing' }));
    const user = await openLeaf();
    await user.click(within(card('proc')).getByRole('button', { name: /view full size/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('video')).toBeNull();
    expect(within(dialog).getByText('Converting…')).toBeInTheDocument();
  });

  it('labels a converting video in search results too', async () => {
    (listItems as jest.Mock).mockResolvedValue([]);
    (searchGallery as jest.Mock).mockResolvedValue({
      items: [{ ...video('proc', { status: 'processing' }), breadcrumb: ['Top', 'Aventus'] }],
      folders: [],
      meta: { itemsTotal: 1, foldersTotal: 0, page: 1, limit: 20 },
    });
    (getItem as jest.Mock).mockImplementation(async (id: string) => video(id, { status: 'processing' }));
    const user = userEvent.setup();
    render(<GalleryClient />);
    await user.type(screen.getByPlaceholderText(/search photos/i), 'a');
    const grid = await waitFor(() => {
      const el = document.querySelector('[data-trace-id$="EL-GRID-gallery-search-result-items"]');
      if (!el) throw new Error('no results yet');
      return el as HTMLElement;
    });
    expect(within(grid).getByText(/converting/i)).toBeInTheDocument();
    expect(grid.querySelector('video')).toBeNull();
  });
});
