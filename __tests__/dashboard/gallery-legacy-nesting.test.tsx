import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GalleryClient from '@/app/dashboard/gallery/GalleryClient';
import type { GalleryFolder, GalleryItem } from '@/lib/gallery/types';

/**
 * #30 — a photo counted and unreachable.
 *
 * Haircare → Generic read "1" in the rail and the pane said the photo was
 * "inside a folder within it. Open that folder to see it" — about a folder the
 * screen never showed. The gallery became two levels on 2026-08-03 and a
 * subfolder was treated as a leaf, but folders nested three deep before that
 * date were never backfilled, and the recursive count walks into them.
 *
 * Rendered through the real component with the API mocked, so these fail if
 * the subfolder branch stops asking for its children or stops drawing them.
 */

jest.mock('@/lib/gallery/api', () => ({
  listFolders: jest.fn(),
  listItems: jest.fn(),
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
  useImageCrop: () => jest.fn(),
}));

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: { role: 'ADMIN' } }),
}));

import { listFolders, listItems } from '@/lib/gallery/api';

const folder = (over: Partial<GalleryFolder>): GalleryFolder => ({
  id: 'x',
  name: 'x',
  parentId: null,
  itemCount: 0,
  createdAt: new Date().toISOString(),
  ...over,
});

const HAIRCARE = folder({ id: 'haircare', name: 'Haircare', itemCount: 1 });
const GENERIC = folder({ id: 'generic', name: 'Generic', parentId: 'haircare', itemCount: 1 });
const LEGACY = folder({ id: 'legacy', name: 'Old shoot', parentId: 'generic', itemCount: 1 });
const PLAIN = folder({ id: 'plain', name: 'Karseell', parentId: 'haircare', itemCount: 0 });

const photo: GalleryItem = {
  id: 'item-1',
  folderId: 'legacy',
  kind: 'image',
  posterUrl: null,
  url: 'https://storage.example/one.webp',
  mimeType: 'image/webp',
  width: 400,
  height: 400,
  durationSeconds: null,
  altText: null,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (listFolders as jest.Mock).mockImplementation(async (parentId?: string) => {
    if (!parentId) return [HAIRCARE];
    if (parentId === 'haircare') return [GENERIC, PLAIN];
    if (parentId === 'generic') return [LEGACY];
    return [];
  });
  (listItems as jest.Mock).mockImplementation(async (folderId: string) =>
    folderId === 'legacy' ? [photo] : [],
  );
});

async function openGeneric(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /expand haircare/i }));
  await user.click(await screen.findByRole('treeitem', { name: /generic/i }));
}

describe('GalleryClient — folders nested before the two-level rule (#30)', () => {
  it('shows the folder a counted photo is actually in', async () => {
    const user = userEvent.setup();
    render(<GalleryClient />);
    await openGeneric(user);

    expect(
      await screen.findByRole('button', { name: /old shoot/i }),
    ).toBeInTheDocument();
    // The old copy sent the admin to a folder that was not on screen.
    expect(screen.queryByText(/Open that folder to see it/i)).not.toBeInTheDocument();
  });

  it('reaches the photo in one tap from there', async () => {
    const user = userEvent.setup();
    render(<GalleryClient />);
    await openGeneric(user);

    await user.click(await screen.findByRole('button', { name: /old shoot/i }));

    await waitFor(() => expect(listItems).toHaveBeenCalledWith('legacy'));
    expect(
      await screen.findByText(/1 item/),
    ).toBeInTheDocument();
  });

  it('leaves an ordinary subfolder exactly as it was — no folder tiles', async () => {
    const user = userEvent.setup();
    render(<GalleryClient />);
    await user.click(await screen.findByRole('button', { name: /expand haircare/i }));
    await user.click(await screen.findByRole('treeitem', { name: /karseell/i }));

    await waitFor(() => expect(listItems).toHaveBeenCalledWith('plain'));
    expect(await screen.findByText(/No photos in/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /inside karseell/i })).not.toBeInTheDocument();
  });

  it('still lists the photos when the folder lookup fails', async () => {
    (listFolders as jest.Mock).mockImplementation(async (parentId?: string) => {
      if (!parentId) return [HAIRCARE];
      if (parentId === 'haircare') return [GENERIC, PLAIN];
      throw new Error('offline');
    });
    (listItems as jest.Mock).mockResolvedValue([{ ...photo, folderId: 'generic' }]);
    const user = userEvent.setup();
    render(<GalleryClient />);
    await openGeneric(user);

    expect(await screen.findByText(/1 item/)).toBeInTheDocument();
  });
});
