'use client';

import React, { useId, useState } from 'react';
import ChartLegend, { type ChartLegendItem } from './ChartLegend';
import ChartTableView, { type ChartTableViewProps } from './ChartTableView';
import ChartEmpty from './ChartEmpty';
import ChartSkeleton from './ChartSkeleton';
import { useMeasuredSize, type MeasuredSize } from './chart-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ChartFrameProps<T extends Record<string, any> = Record<string, any>> {
  title: string;
  /** Summary read by screen readers on the SVG region (role="img"). */
  ariaLabel: string;
  legend?: ChartLegendItem[];
  onLegendToggle?: (id: string) => void;
  height?: number;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  /** Table-view props — omit to hide the table toggle entirely. */
  table?: ChartTableViewProps<T>;
  /** Render prop so the SVG can be sized from the measured container. */
  children: (size: MeasuredSize) => React.ReactNode;
  animationDelay?: string;
}

export default function ChartFrame<T extends Record<string, any> = Record<string, any>>({
  title,
  ariaLabel,
  legend,
  onLegendToggle,
  height = 220,
  loading = false,
  empty = false,
  emptyMessage,
  table,
  children,
  animationDelay,
}: ChartFrameProps<T>) {
  const [showTable, setShowTable] = useState(false);
  const [containerRef, size] = useMeasuredSize({ width: 480, height });
  const titleId = useId();

  return (
    <div className="dash-card dash-chart" style={{ animationDelay }}>
      <div className="dash-chart-head">
        <h3 className="dash-chart-title" id={titleId}>
          {title}
        </h3>
        <div className="dash-chart-actions">
          {!loading && !empty && legend ? (
            <ChartLegend items={legend} onToggle={onLegendToggle} />
          ) : null}
          {!loading && !empty && table ? (
            <button
              type="button"
              className="dash-btn-ghost dash-chart-toggle"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
            >
              {showTable ? 'View chart' : 'View table'}
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <ChartSkeleton height={height} />
      ) : empty ? (
        <ChartEmpty message={emptyMessage} height={height} />
      ) : showTable && table ? (
        <ChartTableView {...table} />
      ) : (
        <div ref={containerRef} className="dash-chart-svg-wrap" style={{ height }} role="img" aria-labelledby={titleId} aria-label={ariaLabel}>
          {children(size)}
        </div>
      )}
    </div>
  );
}
