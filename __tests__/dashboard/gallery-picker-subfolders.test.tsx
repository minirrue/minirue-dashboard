import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GalleryPickerModal from '@/components/dashboard/GalleryPickerModal';
import { listFolders, listItems } from '@/lib/gallery/api';
import type { GalleryFolder, GalleryItem } from '@/lib/gallery/types';

/**
 * Owner report, 2026-08-03: "cant enter to subfolders and from subfolder to
 * images inside from any global picker".
 *
 * The cause was that the picker only ever called `listFolders()` with NO parent,
 * so it showed top-level folders and nothing else, and opening a folder loaded
 * its ITEMS but never its child folders. A nested gallery was therefore
 * unreachable from every picker in the dashboard — and it failed silently: you
 * saw "No items in this folder yet" for a folder whose pictures were one level
 * further down.
 *
 * These tests assert the two things that were actually broken: that opening a
 * folder asks for ITS children, and that you can keep going down and get back up.
 */

jest.mock('@/lib/gallery/api', () => ({
  listFolders: jest.fn(),
  listItems: jest.fn(),
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

const mockListFolders = listFolders as jest.MockedFunction<typeof listFolders>;
const mockListItems = listItems as jest.MockedFunction<typeof listItems>;

const folder = (
  id: string,
  name: string,
  parentId: string | null = null,
): GalleryFolder => ({
  id,
  name,
  parentId,
  itemCount: 0,
  createdAt: '2026-08-03T00:00:00.000Z',
});

const item = (id: string, folderId: string): GalleryItem => ({
  id,
  folderId,
  kind: 'image' as const,
  url: `https://img.test/${id}.webp`,
  posterUrl: null,
  altText: null,
  mimeType: 'image/webp',
  width: 800,
  height: 800,
  durationSeconds: null,
  createdAt: '2026-08-03T00:00:00.000Z',
});

beforeEach(() => {
  jest.clearAllMocks();
});

it('opening a folder requests ITS child folders, not the roots again', async () => {
  // Root has one folder; that folder has a child; the child holds the picture.
  mockListFolders.mockImplementation(async (parentId?: string) => {
    if (!parentId) return [folder('f1', 'All Products')];
    if (parentId === 'f1') return [folder('f2', 'Perfumes', 'f1')];
    return [];
  });
  mockListItems.mockResolvedValue([]);

  render(<GalleryPickerModal onSelect={jest.fn()} onClose={jest.fn()} />);

  await screen.findByText(/All Products/);
  await userEvent.click(screen.getByText(/All Products/));

  // The regression: this call was never made, so 'Perfumes' could not be seen.
  await waitFor(() => expect(mockListFolders).toHaveBeenCalledWith('f1'));
  expect(await screen.findByText(/Perfumes/)).toBeInTheDocument();
});

it('reaches an image two levels down, and the crumb walks back out', async () => {
  mockListFolders.mockImplementation(async (parentId?: string) => {
    if (!parentId) return [folder('f1', 'All Products')];
    if (parentId === 'f1') return [folder('f2', 'Perfumes', 'f1')];
    return [];
  });
  mockListItems.mockImplementation(async (folderId: string) =>
    folderId === 'f2' ? [item('i1', 'f2')] : [],
  );

  const onSelect = jest.fn();
  render(<GalleryPickerModal onSelect={onSelect} onClose={jest.fn()} />);

  await userEvent.click(await screen.findByText(/All Products/));
  await userEvent.click(await screen.findByText(/Perfumes/));

  // The picture is only reachable because both levels were walked.
  await waitFor(() => expect(mockListItems).toHaveBeenCalledWith('f2'));
  const thumb = await screen.findByRole('button', { name: '' });
  expect(thumb).toBeInTheDocument();

  // And back out — a subfolder must not be a dead end.
  await userEvent.click(screen.getByRole('button', { name: 'Gallery' }));
  await waitFor(() => expect(mockListFolders).toHaveBeenLastCalledWith(undefined));
});

it('offers a device upload alongside the gallery, per the owner ask', async () => {
  mockListFolders.mockResolvedValue([]);
  mockListItems.mockResolvedValue([]);

  render(<GalleryPickerModal onSelect={jest.fn()} onClose={jest.fn()} />);

  // At the root there is no folder to upload into yet, so the generic label.
  expect(
    await screen.findByRole('button', { name: /upload from device/i }),
  ).toBeInTheDocument();
});
