import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GalleryPickerModal from '@/components/dashboard/GalleryPickerModal';
import type { GallerySearchResult } from '@/lib/gallery/types';

// task-w2.3-brief.md, Part B: "a search input on the gallery page and in
// GalleryPickerModal. Results show the breadcrumb. Empty query returns to
// normal folder browsing." Mocked at the module boundary, matching
// __tests__/dashboard/notification-centre.test.tsx's pattern.
jest.mock('@/lib/gallery/api', () => ({
  listFolders: jest.fn().mockResolvedValue([]),
  createFolder: jest.fn(),
  listItems: jest.fn().mockResolvedValue([]),
  uploadItem: jest.fn(),
  searchGallery: jest.fn(),
  ensureProductFolder: jest.fn(),
}));

import { searchGallery } from '@/lib/gallery/api';

function emptyResult(): GallerySearchResult {
  return { items: [], folders: [], meta: { itemsTotal: 0, foldersTotal: 0, page: 1, limit: 20 } };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GalleryPickerModal — search', () => {
  it('does not search on an empty query, and normal folder browsing shows instead', () => {
    render(<GalleryPickerModal onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(searchGallery).not.toHaveBeenCalled();
    expect(screen.getByText(/open a folder to see its photos/i)).toBeInTheDocument();
  });

  it('typing a query searches and shows each result with its breadcrumb', async () => {
    (searchGallery as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'item-1',
          folderId: 'folder-leaf',
          kind: 'image',
          posterUrl: null,
          url: 'https://storage.example/aventus.webp',
          mimeType: 'image/webp',
          width: 400,
          height: 400,
          durationSeconds: null,
          altText: 'Aventus 100ml',
          createdAt: new Date().toISOString(),
          breadcrumb: ['Perfumes', 'Creed', 'Aventus'],
        },
      ],
      folders: [
        {
          id: 'folder-creed',
          name: 'Creed',
          parentId: 'folder-perfumes',
          itemCount: 3,
          createdAt: new Date().toISOString(),
          breadcrumb: ['Perfumes', 'Creed'],
        },
      ],
      meta: { itemsTotal: 1, foldersTotal: 1, page: 1, limit: 20 },
    } satisfies GallerySearchResult);

    const user = userEvent.setup();
    const { container } = render(<GalleryPickerModal onSelect={jest.fn()} onClose={jest.fn()} />);

    await user.type(screen.getByPlaceholderText(/search photos, videos and folders/i), 'aventus');

    await waitFor(() => expect(searchGallery).toHaveBeenCalledWith('aventus'));
    const folderButton = await waitFor(() => {
      const el = container.querySelector(
        '[data-trace-id="CMP-DASHBOARD-GALLERY-PICKER::EL-BTN-search-result-folder@folder-creed"]',
      );
      if (!el) throw new Error('folder result not rendered yet');
      return el;
    });
    expect(folderButton).toHaveTextContent('Perfumes / Creed');
    expect(screen.getAllByTitle('Perfumes / Creed / Aventus').length).toBeGreaterThan(0);

    // Normal folder browsing is replaced by search results while a query is
    // present.
    expect(screen.queryByText(/open a folder to see its photos/i)).toBeNull();
  });

  it('clearing the query back to empty returns to normal folder browsing', async () => {
    (searchGallery as jest.Mock).mockResolvedValue(emptyResult());
    const user = userEvent.setup();
    render(<GalleryPickerModal onSelect={jest.fn()} onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText(/search photos, videos and folders/i);
    await user.type(input, 'aventus');
    await waitFor(() => expect(searchGallery).toHaveBeenCalled());

    await user.clear(input);
    expect(screen.getByText(/open a folder to see its photos/i)).toBeInTheDocument();
  });

  it('selecting a matched item calls onSelect directly', async () => {
    (searchGallery as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'item-1',
          folderId: 'folder-leaf',
          kind: 'image',
          posterUrl: null,
          url: 'https://storage.example/aventus.webp',
          mimeType: 'image/webp',
          width: 400,
          height: 400,
          durationSeconds: null,
          altText: 'Aventus 100ml',
          createdAt: new Date().toISOString(),
          breadcrumb: ['Perfumes', 'Creed', 'Aventus'],
        },
      ],
      folders: [],
      meta: { itemsTotal: 1, foldersTotal: 0, page: 1, limit: 20 },
    } satisfies GallerySearchResult);

    const onSelect = jest.fn();
    const user = userEvent.setup();
    render(<GalleryPickerModal onSelect={onSelect} onClose={jest.fn()} />);
    await user.type(screen.getByPlaceholderText(/search photos, videos and folders/i), 'aventus');

    const resultButton = await screen.findByTitle('Perfumes / Creed / Aventus');
    await user.click(resultButton);

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1' }),
    );
  });
});
