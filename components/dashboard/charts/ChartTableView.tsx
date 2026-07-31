'use client';

import React from 'react';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ChartTableViewProps<T extends Record<string, any>> {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
}

/**
 * Renders a chart's underlying data as a `DashboardTable`. This is both the
 * a11y relief channel (paired with the `role="img"` SVG's aria-label) and
 * what an operator actually wants when they need the exact figure rather
 * than a mark on a scale.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ChartTableView<T extends Record<string, any>>({
  columns,
  rows,
  emptyMessage = 'No data to display',
}: ChartTableViewProps<T>) {
  return (
    <DashboardTable<T>
      columns={columns}
      data={rows}
      pageSize={rows.length > 10 ? 10 : 0}
      emptyMessage={emptyMessage}
    />
  );
}
