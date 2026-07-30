'use client';

import React, { useMemo, useState } from 'react';
import { scaleBand } from 'd3-scale';
import ChartFrame from './ChartFrame';
import ChartTooltip from './ChartTooltip';
import { seriesColor, niceTicks, roundedBarPath, formatCompact } from './chart-utils';
import type { MeasuredSize } from './chart-utils';
import type { Column } from '@/components/dashboard/DashboardTable';

export interface StackedBarSeries<T> {
  id: string;
  label: string;
  y: (d: T) => number;
}

export interface StackedBarProps<T> {
  data: T[];
  category: (d: T, i: number) => string;
  /** Drawn bottom-to-top in array order. */
  series: StackedBarSeries<T>[];
  title: string;
  height?: number;
  valueFormat?: (v: number) => string;
  animationDelay?: string;
}

const MARGIN = { top: 12, right: 12, bottom: 28, left: 44 };
const RADIUS = 4;
const SEGMENT_GAP = 2; // --mr-chart-surface gap between stacked segments (DESIGN.md)

export default function StackedBar<T>({
  data,
  category,
  series,
  title,
  height = 240,
  valueFormat = formatCompact,
  animationDelay,
}: StackedBarProps<T>) {
  const [hover, setHover] = useState<{ categoryIndex: number; x: number; y: number } | null>(null);

  const categories = useMemo(() => data.map((d, i) => category(d, i)), [data, category]);
  const stacks = useMemo(
    () =>
      data.map((d) => {
        let running = 0;
        return series.map((s) => {
          const v = Math.max(s.y(d), 0);
          const from = running;
          running += v;
          return { from, to: running, raw: v };
        });
      }),
    [data, series],
  );
  const totals = stacks.map((row) => row[row.length - 1]?.to ?? 0);
  const maxTotal = Math.max(1, ...totals);
  const ticks = niceTicks(0, maxTotal, 4);
  const domainMax = Math.max(maxTotal, ticks[ticks.length - 1] ?? maxTotal);

  const renderChart = (size: MeasuredSize) => {
    const width = Math.max(size.width, 40);
    const innerW = Math.max(width - MARGIN.left - MARGIN.right, 1);
    const innerH = Math.max(height - MARGIN.top - MARGIN.bottom, 1);

    const band = scaleBand<string>().domain(categories).range([MARGIN.left, MARGIN.left + innerW]).paddingInner(0.3);
    const bandwidth = band.bandwidth();
    const yAt = (v: number) => MARGIN.top + innerH - (v / (domainMax || 1)) * innerH;
    const labelEvery = Math.max(1, Math.ceil(categories.length / 8));

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((t) => (
          <line key={t} x1={MARGIN.left} x2={width - MARGIN.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--mr-chart-grid)" strokeWidth={1} />
        ))}
        {ticks.map((t) => (
          <text key={`l-${t}`} x={MARGIN.left - 8} y={yAt(t)} textAnchor="end" dominantBaseline="middle" className="dash-chart-tick-label">
            {valueFormat(t)}
          </text>
        ))}
        {categories.map((c, i) =>
          i % labelEvery === 0 || i === categories.length - 1 ? (
            <text key={`x-${i}`} x={(band(c) ?? 0) + bandwidth / 2} y={height - 8} textAnchor="middle" className="dash-chart-tick-label">
              {c}
            </text>
          ) : null,
        )}

        {stacks.map((row, ci) => {
          const cx = band(categories[ci]) ?? 0;
          return (
            <g
              key={ci}
              onPointerEnter={(evt) => setHover({ categoryIndex: ci, x: evt.clientX, y: evt.clientY })}
              onPointerMove={(evt) => setHover({ categoryIndex: ci, x: evt.clientX, y: evt.clientY })}
              onPointerLeave={() => setHover(null)}
            >
              {row.map((seg, si) => {
                const yTo = yAt(seg.to);
                const yFrom = yAt(seg.from);
                const segHeight = Math.max(yFrom - yTo, 0);
                const isTop = si === row.length - 1;
                const path = roundedBarPath(cx, yTo, bandwidth, segHeight, isTop ? RADIUS : 0, 'vertical');
                return (
                  <path
                    key={series[si].id}
                    d={path}
                    fill={seriesColor(si)}
                    className="dash-chart-mark-enter"
                    style={{ animationDelay: `${ci * 12}ms` }}
                  />
                );
              })}
              {/* Thin surface-coloured strips at each internal boundary — the
                  2px gap between stacked segments (DESIGN.md). */}
              {row.slice(0, -1).map((seg, si) => (
                <rect
                  key={`gap-${series[si].id}`}
                  x={cx}
                  y={yAt(seg.to) - SEGMENT_GAP / 2}
                  width={bandwidth}
                  height={SEGMENT_GAP}
                  fill="var(--mr-chart-surface)"
                />
              ))}
            </g>
          );
        })}
      </svg>
    );
  };

  const ariaLabel = `Stacked bar chart “${title}” with ${series.length} series across ${categories.length} categories.`;

  const tooltipItems =
    hover != null
      ? series.map((s, si) => ({ label: s.label, value: valueFormat(stacks[hover.categoryIndex][si].raw), color: seriesColor(si) }))
      : [];

  const tableColumns: Column<Record<string, string>>[] = [
    { key: 'category', label: 'Category' },
    ...series.map((s) => ({ key: s.id, label: s.label })),
    { key: 'total', label: 'Total' },
  ];
  const tableRows = data.map((d, i) => {
    const row: Record<string, string> = { category: categories[i] };
    series.forEach((s, si) => {
      row[s.id] = valueFormat(stacks[i][si].raw);
    });
    row.total = valueFormat(totals[i]);
    return row;
  });

  return (
    <>
      <ChartFrame
        title={title}
        ariaLabel={ariaLabel}
        empty={data.length === 0}
        height={height}
        animationDelay={animationDelay}
        legend={series.map((s, i) => ({ id: s.id, label: s.label, color: seriesColor(i) }))}
        table={{ columns: tableColumns, rows: tableRows }}
      >
        {renderChart}
      </ChartFrame>
      {hover ? (
        <ChartTooltip x={hover.x} y={hover.y} visible title={categories[hover.categoryIndex]} items={tooltipItems} />
      ) : null}
    </>
  );
}
