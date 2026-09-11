import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GalleryClient from '@/app/dashboard/gallery/GalleryClient';
import type { GalleryFolder, GalleryItem } from '@/lib/gallery/types';

/**
 * #15, part 1 — and the tail of #2.
 *
 * The issue reported `folders`, `loading` and `loadError` as set and never read
 * on this page, and asked for the load failure to be shown with a retry. It
 * already is: `FolderTree` owns the rail and renders "Loading folders…",
 * "Could not load folders." with a Retry, and "No folders yet." as three
 * distinct states. What was left in GalleryClient was the OLD flat list — a
 * second `listFolders()` on mount whose result nothing rendered.
 *
 * The part that actually bit was underneath it: both item-count adjustments
 * wrote to that unrendered array, so after adding or deleting a photo the
 * number beside the folder never moved and neither did the count the right pane
 * quotes. That count decides whether the pane says a folder is empty or says
 * its photos are in a subfolder — the contradiction from #2 — so deleting the
 * last photo in a folder left the pane pointing at a subfolder that is not
 * there.
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

import { deleteItem, listFolders, listItems } from '@/lib/gallery/api';

function makeFolder(over: Partial<GalleryFolder> = {}): GalleryFolder {
  return {
    id: 'folder-leaf',
    name: 'Aventus',
    parentId: 'folder-top',
    itemCount: 1,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function makeItem(over: Partial<GalleryItem> = {}): GalleryItem {
  return {
    id: 'item-1',
    folderId: 'folder-leaf',
    kind: 'image',
    posterUrl: null,
    url: 'https://storage.example/one.webp',
    mimeType: 'image/webp',
    width: 400,
    height: 400,
    durationSeconds: null,
    altText: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

/**
 * The item card's own Delete, not the right pane's "delete this folder" — both
 * are buttons reading "Delete".
 */
async function findItemDeleteButton(): Promise<HTMLElement> {
  const el = await waitFor(() => {
    const found = document.querySelector(
      '[data-trace-id="PG-DASHBOARD-GAL-001::EL-BTN-delete-gallery-item@item-1"]',
    );
    if (!found) throw new Error('item delete button not rendered yet');
    return found as HTMLElement;
  });
  return el;
}

beforeEach(() => {
  jest.clearAllMocks();
  (listFolders as jest.Mock).mockResolvedValue([makeFolder()]);
  (listItems as jest.Mock).mockResolvedValue([makeItem()]);
  (deleteItem as jest.Mock).mockResolvedValue(undefined);
});

describe('GalleryClient — one folder request, one owner', () => {
  it('does not fetch the folder list a second time for a list it never renders', async () => {
    render(<GalleryClient />);

    // The rail's own root load, and nothing else. Two calls here meant the
    // page was duplicating the request to fill state it never showed.
    await waitFor(() => expect(listFolders).toHaveBeenCalledTimes(1));
    expect(listFolders).toHaveBeenCalledWith();
  });

  it('leaves the failed-load message to the rail, which offers a retry', async () => {
    (listFolders as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<GalleryClient />);

    expect(await screen.findByText(/could not load folders/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // Exactly one message — the page must not add a second banner of its own.
    expect(screen.getAllByText(/could not load folders/i)).toHaveLength(1);
  });
});

describe('GalleryClient — the count after a photo goes', () => {
  it('does not claim the photos moved to a subfolder after the last one is deleted', async () => {
    const user = userEvent.setup();
    render(<GalleryClient />);

    await user.click(await screen.findByRole('treeitem', { name: /aventus/i }));
    await waitFor(() => expect(listItems).toHaveBeenCalled());

    await user.click(await findItemDeleteButton());

    await waitFor(() => expect(deleteItem).toHaveBeenCalledWith('item-1'));

    // The folder is genuinely empty now. Before the count was corrected it
    // still read 1, and the pane said the photo was "inside a folder within
    // it" — about a folder with no subfolders at all.
    await waitFor(() =>
      expect(screen.getByText(/No photos in/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByText(/inside a folder within it/i),
    ).not.toBeInTheDocument();
  });

  it('re-reads the rail so its number is the server’s, not a local guess', async () => {
    const user = userEvent.setup();
    render(<GalleryClient />);

    await user.click(await screen.findByRole('treeitem', { name: /aventus/i }));
    await waitFor(() => expect(listItems).toHaveBeenCalled());

    const callsBefore = (listFolders as jest.Mock).mock.calls.length;
    await user.click(await findItemDeleteButton());

    await waitFor(() =>
      expect((listFolders as jest.Mock).mock.calls.length).toBeGreaterThan(
        callsBefore,
      ),
    );
  });
});
