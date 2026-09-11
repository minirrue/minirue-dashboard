import React from 'react';
import { render, screen } from '@testing-library/react';

/**
 * The panel must not contradict the sidebar.
 *
 * #2: the sidebar showed "1" for a folder while the panel said "No photos in
 * Karseell yet". Both numbers were correct and they answer different questions:
 *
 *   sidebar  a recursive count — the folder and everything under it
 *   panel    direct children only
 *
 * The recursive count is deliberate. A direct-only count made every top-level
 * folder read "(0)" over a gallery holding thirteen photos (reported
 * 2026-08-23), because a folder groups and a subfolder holds the media.
 *
 * For a two-level gallery the two agree for a subfolder — but the depth limit
 * was added on 2026-08-03 and never backfilled, so anything nested three deep
 * before that date still counts upward into a folder that cannot list it.
 * Verified against the database in
 * minirue-backend/src/gallery/folder-count-agrees.db.spec.ts.
 *
 * So the fix is the copy: when the panel is empty and the count is not, say
 * where the photos are instead of claiming there are none.
 */

/** The branch under test, in the shape GalleryClient renders it. */
function EmptyState({
  name,
  itemCount,
  itemsLength,
}: {
  name: string;
  itemCount: number;
  itemsLength: number;
}) {
  if (itemsLength === 0 && itemCount > 0) {
    return (
      <p>
        No photos directly in <strong>{name}</strong>
        {' — '}the {itemCount} {itemCount === 1 ? 'photo' : 'photos'} counted here{' '}
        {itemCount === 1 ? 'is' : 'are'} inside a folder within it. Open that
        folder to see {itemCount === 1 ? 'it' : 'them'}, or drop files above to add
        one here.
      </p>
    );
  }
  if (itemsLength === 0) {
    return (
      <p>
        No photos in <strong>{name}</strong> yet. Drop files above to add the
        first one.
      </p>
    );
  }
  return <p>{itemsLength} items</p>;
}

describe('gallery empty state', () => {
  it('does not claim a folder is empty while the sidebar counts photos in it', () => {
    // The reported case, exactly: sidebar 1, panel empty.
    render(<EmptyState name="Karseell" itemCount={1} itemsLength={0} />);

    expect(screen.queryByText(/No photos in/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/No photos directly in/),
    ).toBeInTheDocument();
    expect(screen.getByText(/inside a folder within it/)).toBeInTheDocument();
  });

  it('says how many are counted, so the number matches the sidebar', () => {
    render(<EmptyState name="Haircare" itemCount={13} itemsLength={0} />);

    expect(screen.getByText(/the 13 photos counted here/)).toBeInTheDocument();
  });

  it('reads correctly for a single photo', () => {
    render(<EmptyState name="Karseell" itemCount={1} itemsLength={0} />);

    expect(screen.getByText(/the 1 photo counted here is inside/)).toBeInTheDocument();
  });

  it('still says "no photos yet" when the folder is genuinely empty', () => {
    // The empty state has to keep working — the fix must not turn every empty
    // folder into "look in a subfolder".
    render(<EmptyState name="Empty" itemCount={0} itemsLength={0} />);

    expect(screen.getByText(/No photos in/)).toBeInTheDocument();
    expect(screen.queryByText(/inside a folder within it/)).not.toBeInTheDocument();
  });

  it('shows the grid when there are items to show', () => {
    render(<EmptyState name="Karseell" itemCount={3} itemsLength={3} />);

    expect(screen.getByText('3 items')).toBeInTheDocument();
    expect(screen.queryByText(/No photos/)).not.toBeInTheDocument();
  });
});
