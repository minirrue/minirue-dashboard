'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';

/* ── Types ── */

export interface Column<T> {
  /** Unique key matching a property on the row data */
  key: string;
  /** Header label */
  label: string;
  /** Enable sorting on this column */
  sortable?: boolean;
  /** Custom cell renderer */
  render?: (row: T) => React.ReactNode;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DashboardTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  /** Rows per page. 0 = no pagination. */
  pageSize?: number;
  /** Render when data is empty */
  emptyMessage?: string;
}

type SortDir = 'asc' | 'desc';

/* ── Helpers ── */

/** Columns to show on mobile cards (first 3). */
const MOBILE_VISIBLE_COLS = 3;

/* ── Component ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DashboardTable<T extends Record<string, any>>({
  columns,
  data,
  pageSize = 10,
  emptyMessage = 'No data to display',
}: DashboardTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  /* Mobile detection */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /* Sort */
  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null || bv == null) return 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return copy;
  }, [data, sortKey, sortDir]);

  /* Paginate */
  const paginated = useMemo(() => {
    if (pageSize <= 0) return sorted;
    const start = page * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const totalPages = pageSize > 0 ? Math.ceil(data.length / pageSize) : 1;

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
      setPage(0);
    },
    [sortKey],
  );

  const toggleExpand = useCallback((ri: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(ri)) next.delete(ri);
      else next.add(ri);
      return next;
    });
  }, []);

  /* ── Desktop table renderer ── */
  const renderTable = () => (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                data-sortable={col.sortable ? 'true' : undefined}
                data-sort-dir={sortKey === col.key ? sortDir : undefined}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                style={{ textAlign: col.align ?? 'left' }}
              >
                {col.label}
                {col.sortable && (
                  <span className="dash-sort-icon">
                    {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '▽'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="dash-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            paginated.map((row, ri) => (
              <tr key={ri}>
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align ?? 'left' }}>
                    {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  /* ── Mobile card renderer ── */
  const renderCards = () => {
    if (paginated.length === 0) {
      return <div className="dash-table-empty">{emptyMessage}</div>;
    }

    return (
      <div className="dash-mobile-cards">
        {paginated.map((row, ri) => {
          const isExpanded = expandedRows.has(ri);
          const visibleCols = columns.slice(0, MOBILE_VISIBLE_COLS);
          const hiddenCols = columns.slice(MOBILE_VISIBLE_COLS);

          return (
            <div
              key={ri}
              className={`dash-mobile-card${isExpanded ? ' dash-mobile-card-expanded' : ''}`}
            >
              {/* Visible fields (first 3 columns) */}
              {visibleCols.map((col) => (
                <div className="dash-mobile-card-field" key={col.key}>
                  <span className="dash-mobile-card-label">{col.label}</span>
                  <span className="dash-mobile-card-value">
                    {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                  </span>
                </div>
              ))}

              {/* Hidden fields (expandable) */}
              {hiddenCols.length > 0 && (
                <div
                  className={`dash-mobile-card-hidden${isExpanded ? ' dash-mobile-card-hidden--open' : ''}`}
                >
                  {hiddenCols.map((col) => (
                    <div className="dash-mobile-card-field" key={col.key}>
                      <span className="dash-mobile-card-label">{col.label}</span>
                      <span className="dash-mobile-card-value">
                        {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Expand / collapse button */}
              {hiddenCols.length > 0 && (
                <button
                  className="dash-mobile-card-expand-btn"
                  onClick={() => toggleExpand(ri)}
                >
                  {isExpanded ? 'Show less' : `Show ${hiddenCols.length} more`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      {isMobile ? renderCards() : renderTable()}

      {pageSize > 0 && totalPages > 1 && (
        <div className="dash-pagination">
          <span className="dash-pagination-info">
            {page * pageSize + 1}&ndash;{Math.min((page + 1) * pageSize, data.length)} of{' '}
            {data.length}
          </span>
          <div className="dash-pagination-controls">
            <button
              className="dash-pagination-btn"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                className="dash-pagination-btn"
                data-active={i === page ? 'true' : undefined}
                onClick={() => setPage(i)}
              >
                {i + 1}
              </button>
            ))}
            <button
              className="dash-pagination-btn"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
