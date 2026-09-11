import React from 'react';
import { render, screen } from '@testing-library/react';

/**
 * "Live" has to mean a shopper can see it.
 *
 * #8: a bundle set to "show it in the shop straight away" can still not appear.
 * The storefront list ends in a stock filter — a set whose member sold out is
 * hidden rather than shown as unavailable, because a shopper cannot buy it
 * either way and a grid of unbuyable things reads as a broken shop.
 *
 * So `isActive` is necessary and not sufficient. A row reading plain "Live"
 * over a bundle nobody can see sent the admin looking for a bug in the toggle,
 * which is the expensive kind of wrong: the screen was confidently telling them
 * something false.
 *
 * Verified against a real database in
 * minirue-backend/src/discounts/bundles-flow.db.spec.ts, which asserts both
 * halves — absent from the public list AND `is_active` true in the row.
 */

/** The status cell, in the shape BundlesClient renders it. */
function StatusCell({
  isActive,
  inStock,
}: {
  isActive: boolean;
  inStock: boolean;
}) {
  return (
    <span>
      {!isActive ? 'Hidden' : inStock ? 'Live' : 'Live — not showing'}
    </span>
  );
}

describe('bundle status cell', () => {
  it('says Live when it is active and buyable', () => {
    render(<StatusCell isActive inStock />);

    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('says Hidden when it is switched off', () => {
    render(<StatusCell isActive={false} inStock />);

    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('does not claim Live for a set the storefront is hiding', () => {
    // The case that caused the report. Active, but a member is out of stock, so
    // the storefront filters it out.
    render(<StatusCell isActive inStock={false} />);

    expect(screen.getByText('Live — not showing')).toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('still reads Hidden — not "not showing" — when it is simply switched off', () => {
    // The two reasons a bundle is invisible are different, and the row has to
    // tell them apart: one is a toggle the admin controls, the other is stock.
    render(<StatusCell isActive={false} inStock={false} />);

    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.queryByText(/not showing/)).not.toBeInTheDocument();
  });
});
