import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';

/**
 * DashboardTable keeps its own `page` state. Task 4's search box narrows `data`
 * without ever telling the table, which used to strand the admin on a page past
 * the end of the new result set — the table would slice past the array and show
 * the empty message even though matches existed on page 1. These tests pin the
 * clamp-on-shrink fix and the no-reset-on-same-size-refetch guardrail that a
 * naive fix (reset to 0 on every data change) would have broken.
 */

interface Row {
  id: number;
  name: string;
}

const columns: Column<Row>[] = [{ key: 'name', label: 'Name' }];

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, name: `Row ${i}` }));
}

describe('DashboardTable pagination', () => {
  beforeEach(() => {
    // DashboardTable does mobile detection via matchMedia, which jsdom doesn't implement.
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  it('clamps to the last valid page when data shrinks past the current page, instead of showing the empty message', () => {
    const { rerender } = render(
      <DashboardTable<Row> columns={columns} data={makeRows(25)} pageSize={10} />,
    );

    // Navigate to page 3 (25 rows / 10 per page => 3 pages).
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByText('Row 20')).toBeInTheDocument();

    // A search narrows the result set to 4 rows, all of which now live on page 1.
    rerender(<DashboardTable<Row> columns={columns} data={makeRows(4)} pageSize={10} />);

    expect(screen.getByText('Row 0')).toBeInTheDocument();
    expect(screen.getByText('Row 3')).toBeInTheDocument();
    expect(screen.queryByText('No data to display')).not.toBeInTheDocument();
  });

  it('does not knock the admin back to page 1 when data is replaced with a same-size array (e.g. a background refetch)', () => {
    const { rerender } = render(
      <DashboardTable<Row> columns={columns} data={makeRows(25)} pageSize={10} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Row 10')).toBeInTheDocument();

    // Same shape/size, new array identity — as a background refetch would produce.
    rerender(<DashboardTable<Row> columns={columns} data={makeRows(25)} pageSize={10} />);

    // Still on page 2, not reset to page 1.
    expect(screen.getByText('Row 10')).toBeInTheDocument();
    expect(screen.queryByText('Row 0')).not.toBeInTheDocument();
  });
});
