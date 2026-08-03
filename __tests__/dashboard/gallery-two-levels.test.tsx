import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FolderTree from '@/app/dashboard/gallery/FolderTree';
import { listFolders } from '@/lib/gallery/api';
import type { GalleryFolder } from '@/lib/gallery/types';

/**
 * Owner rule, 2026-08-03: "there is no nesting inside subfolder please remove it
 * only folder and subfolder".
 *
 * The gallery is exactly two levels — a folder groups, and the folders inside it
 * hold the photos. The first cut of the tree let every node expand, so a
 * subfolder rendered a chevron and then "No folders inside", which is an
 * invitation to make a third level that the server refuses to create.
 *
 * A subfolder is a LEAF: no expander, no empty-branch line, and arrow keys do
 * nothing. Pinned here because the symptom is cosmetic and easy to reintroduce.
 */

jest.mock('@/lib/gallery/api', () => ({
  listFolders: jest.fn(),
}));

const mockListFolders = listFolders as jest.MockedFunction<typeof listFolders>;

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

beforeEach(() => {
  jest.clearAllMocks();
  mockListFolders.mockImplementation(async (parentId?: string) => {
    if (!parentId) return [folder('top', 'All Products')];
    if (parentId === 'top') return [folder('sub', 'Perfumes', 'top')];
    return [];
  });
});

it('a top-level folder can expand', async () => {
  render(<FolderTree selectedId={null} onSelect={jest.fn()} refreshToken={0} />);

  const twisty = await screen.findByRole('button', { name: /expand all products/i });
  expect(twisty).toBeInTheDocument();
});

it('a subfolder has no expander at all', async () => {
  render(<FolderTree selectedId={null} onSelect={jest.fn()} refreshToken={0} />);

  await userEvent.click(
    await screen.findByRole('button', { name: /expand all products/i }),
  );
  expect(await screen.findByText('Perfumes')).toBeInTheDocument();

  // The regression: a chevron here invited a third level.
  expect(
    screen.queryByRole('button', { name: /expand perfumes/i }),
  ).not.toBeInTheDocument();
});

it('does not tell a subfolder it is empty — it cannot hold folders', async () => {
  render(<FolderTree selectedId={null} onSelect={jest.fn()} refreshToken={0} />);

  await userEvent.click(
    await screen.findByRole('button', { name: /expand all products/i }),
  );
  const sub = await screen.findByText('Perfumes');

  // Double-click used to expand any node; on a leaf it must do nothing.
  await userEvent.dblClick(sub);

  expect(screen.queryByText(/no folders inside/i)).not.toBeInTheDocument();
  // And it never asks the server for a third level.
  await waitFor(() => {
    expect(mockListFolders).not.toHaveBeenCalledWith('sub');
  });
});

it('still selects a subfolder on a single click', async () => {
  const onSelect = jest.fn();
  render(<FolderTree selectedId={null} onSelect={onSelect} refreshToken={0} />);

  await userEvent.click(
    await screen.findByRole('button', { name: /expand all products/i }),
  );
  await userEvent.click(await screen.findByText('Perfumes'));

  // Selecting is the whole point of a leaf, and it hands over its ancestors so
  // the right pane can print the path.
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'sub' }),
    [expect.objectContaining({ id: 'top' })],
  );
});
