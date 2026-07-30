'use client';

import React, { useState } from 'react';
import ChartFrame from './ChartFrame';
import ChartTooltip from './ChartTooltip';
import { roundedBarPath, formatCompact } from './chart-utils';
import type { MeasuredSize } from './chart-utils';
import type { Column } from '@/components/dashboard/DashboardTable';

export interface HorizontalBarProps<T> {
  data: T[];
  label: (d: T, i: number) => string;
  value: (d: T) => number;
  title: string;
  valueFormat?: (v: number) => string;
  /** Single-series colour — defaults to the gold categorical slot. */
  color?: string;
  animationDelay?: string;
}

const MARGIN = { top: 8, right: 12, bottom: 8, left: 8 };
const ROW_HEIGHT = 40;
const BAR_HEIGHT = 14;
const RADIUS = 4;

/**
 * Long category names (page paths, campaigns) don't fit beside a bar without
 * truncation, so the label sits on its own line above the bar rather than to
 * its left — the "honest default" the brief calls for instead of clipping.
 */
export default function HorizontalBar<T>({
  data,
  label,
  value,
  title,
  valueFormat = formatCompact,
  color = 'var(--mr-chart-1)',
  animationDelay,
}: HorizontalBarProps<T>) {
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  const maxValue = Math.max(1, ...data.map(value));
  const height = MARGIN.top + MARGIN.bottom + Math.max(data.length, 1) * ROW_HEIGHT;

  const renderChart = (size: MeasuredSize) => {
    const width = Math.max(size.width, 40);
    const innerW = Math.max(width - MARGIN.left - MARGIN.right, 1);

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {data.map((d, i) => {
          const v = Math.max(value(d), 0);
          const barW = (v / maxValue) * innerW;
          const rowTop = MARGIN.top + i * ROW_HEIGHT;
          const barY = rowTop + 20;
          const path = roundedBarPath(MARGIN.left, barY, Math.max(barW, 1), BAR_HEIGHT, RADIUS, 'horizontal');
          return (
            <g
              key={i}
              className="dash-chart-mark-enter"
              style={{ animationDelay: `${i * 25}ms` }}
              onPointerEnter={(evt) => setHover({ index: i, x: evt.clientX, y: evt.clientY })}
              onPointerMove={(evt) => setHover({ index: i, x: evt.clientX, y: evt.clientY })}
              onPointerLeave={() => setHover(null)}
            >
              <text x={MARGIN.left} y={rowTop + 12} className="dash-chart-tick-label" style={{ fill: 'var(--mr-fg-2)' }}>
                {label(d, i)}
              </text>
              <path d={path} fill={color} />
              {/* Selective direct label at the data-end — not one per tick, the single number that matters. */}
              <text x={MARGIN.left + Math.max(barW, 1) + 8} y={barY + BAR_HEIGHT / 2} dominantBaseline="middle" className="dash-chart-tick-label mr-num">
                {valueFormat(v)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const ariaLabel = `Horizontal bar chart “${title}” across ${data.length} categories.`;

  const tooltipItems = hover != null ? [{ label: label(data[hover.index], hover.index), value: valueFormat(value(data[hover.index])), color }] : [];

  const tableColumns: Column<{ category: string; value: string }>[] = [
    { key: 'category', label: 'Category' },
    { key: 'value', label: 'Value' },
  ];
  const tableRows = data.map((d, i) => ({ category: label(d, i), value: valueFormat(value(d)) }));

  return (
    <>
      <ChartFrame
        title={title}
        ariaLabel={ariaLabel}
        empty={data.length === 0}
        height={height}
        animationDelay={animationDelay}
        table={{ columns: tableColumns, rows: tableRows }}
      >
        {renderChart}
      </ChartFrame>
      {hover ? <ChartTooltip x={hover.x} y={hover.y} visible items={tooltipItems} /> : null}
    </>
  );
}
