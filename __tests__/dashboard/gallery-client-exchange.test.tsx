import { describe, expect, it, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GalleryClient from '@/app/dashboard/gallery/GalleryClient';
import type { GalleryFolder, GalleryItem } from '@/lib/gallery/types';

// Same module-mock pattern as gallery-picker-search.test.tsx.
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

// The owner's rule is every upload — including a replace — goes through the
// crop step. Mock the crop provider's hook directly so this test can prove
// GalleryClient's own "Exchange" action (the same bypass ImageField had)
// calls it before exchangeItem, rather than only checking the upload happens.
const mockCropImage = jest.fn();
jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  __esModule: true,
  useImageCrop: () => mockCropImage,
}));

import { exchangeItem, listFolders, listItems } from '@/lib/gallery/api';

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
    url: 'https://storage.example/current.webp',
    mimeType: 'image/webp',
    width: 400,
    height: 400,
    durationSeconds: null,
    altText: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCropImage.mockImplementation((file: File) => Promise.resolve(file));
  (listFolders as jest.Mock).mockResolvedValue([makeFolder()]);
  (listItems as jest.Mock).mockResolvedValue([makeItem()]);
});

async function openFolderAndGetExchangeInput() {
  const user = userEvent.setup();
  render(<GalleryClient />);
  await waitFor(() => expect(listFolders).toHaveBeenCalled());
  await user.click(await screen.findByRole('button', { name: /aventus/i }));
  await waitFor(() => expect(listItems).toHaveBeenCalled());
  const input = await screen.findByRole('button', { name: /exchange/i });
  return input;
}

describe('GalleryClient — Exchange', () => {
  it('crops a replacement file through the shared crop step BEFORE calling exchangeItem', async () => {
    (exchangeItem as jest.Mock).mockResolvedValue(makeItem({ url: 'https://storage.example/replaced.webp' }));
    const callOrder: string[] = [];
    mockCropImage.mockImplementation((file: File) => {
      callOrder.push('crop');
      return Promise.resolve(file);
    });
    (exchangeItem as jest.Mock).mockImplementation(() => {
      callOrder.push('exchangeItem');
      return Promise.resolve(makeItem());
    });

    const user = userEvent.setup();
    render(<GalleryClient />);
    await waitFor(() => expect(listFolders).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: /aventus/i }));
    await waitFor(() => expect(listItems).toHaveBeenCalled());

    const exchangeButton = await screen.findByRole('button', { name: /exchange/i });
    await user.click(exchangeButton);

    const file = new File(['bytes'], 'new.png', { type: 'image/png' });
    const inputs = document.querySelectorAll('input[type="file"]');
    const exchangeInput = Array.from(inputs).find((el) =>
      (el as HTMLInputElement).getAttribute('data-trace-id')?.includes('exchange-file'),
    ) as HTMLInputElement;
    await user.upload(exchangeInput, file);

    await waitFor(() => expect(exchangeItem).toHaveBeenCalled());
    expect(mockCropImage).toHaveBeenCalledWith(file, expect.objectContaining({ title: expect.any(String) }));
    expect(callOrder).toEqual(['crop', 'exchangeItem']);
  });

  it('cancelling the crop (crop step resolves null) never calls exchangeItem', async () => {
    mockCropImage.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<GalleryClient />);
    await waitFor(() => expect(listFolders).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: /aventus/i }));
    await waitFor(() => expect(listItems).toHaveBeenCalled());

    const exchangeButton = await screen.findByRole('button', { name: /exchange/i });
    await user.click(exchangeButton);

    const file = new File(['bytes'], 'new.png', { type: 'image/png' });
    const inputs = document.querySelectorAll('input[type="file"]');
    const exchangeInput = Array.from(inputs).find((el) =>
      (el as HTMLInputElement).getAttribute('data-trace-id')?.includes('exchange-file'),
    ) as HTMLInputElement;
    await user.upload(exchangeInput, file);

    await waitFor(() => expect(mockCropImage).toHaveBeenCalled());
    expect(exchangeItem).not.toHaveBeenCalled();
  });
});
