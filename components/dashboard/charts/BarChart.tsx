'use client';

import React, { useMemo, useState } from 'react';
import { scaleBand } from 'd3-scale';
import ChartFrame from './ChartFrame';
import ChartTooltip from './ChartTooltip';
import { seriesColor, niceTicks, roundedBarPath, formatCompact } from './chart-utils';
import type { MeasuredSize } from './chart-utils';
import type { Column } from '@/components/dashboard/DashboardTable';

export interface BarChartSeries<T> {
  id: string;
  label: string;
  y: (d: T) => number;
}

export interface BarChartProps<T> {
  data: T[];
  category: (d: T, i: number) => string;
  /** One entry = simple bars. Two or more = grouped bars per category. */
  series: BarChartSeries<T>[];
  title: string;
  height?: number;
  valueFormat?: (v: number) => string;
  animationDelay?: string;
}

const MARGIN = { top: 12, right: 12, bottom: 28, left: 44 };
const GAP = 2; // surface gap between adjacent bars (DESIGN.md)
const RADIUS = 4;

export default function BarChart<T>({
  data,
  category,
  series,
  title,
  height = 240,
  valueFormat = formatCompact,
  animationDelay,
}: BarChartProps<T>) {
  const grouped = series.length > 1;
  const [hover, setHover] = useState<{ categoryIndex: number; x: number; y: number } | null>(null);

  const categories = useMemo(() => data.map((d, i) => category(d, i)), [data, category]);
  const maxValue = Math.max(1, ...data.flatMap((d) => series.map((s) => s.y(d))));
  const ticks = niceTicks(0, maxValue, 4);
  const domainMax = Math.max(maxValue, ticks[ticks.length - 1] ?? maxValue);

  const renderChart = (size: MeasuredSize) => {
    const width = Math.max(size.width, 40);
    const innerW = Math.max(width - MARGIN.left - MARGIN.right, 1);
    const innerH = Math.max(height - MARGIN.top - MARGIN.bottom, 1);

    const band = scaleBand<string>().domain(categories).range([MARGIN.left, MARGIN.left + innerW]).paddingInner(0.3);
    const bandwidth = band.bandwidth();
    const barWidth = grouped ? Math.max(1, (bandwidth - GAP * (series.length - 1)) / series.length) : bandwidth;

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

        {data.map((d, ci) => {
          const cx = band(categories[ci]) ?? 0;
          return series.map((s, si) => {
            const v = s.y(d);
            const barX = cx + si * (barWidth + GAP);
            const barY = yAt(Math.max(v, 0));
            const barH = Math.abs(yAt(0) - barY);
            const path = roundedBarPath(barX, barY, barWidth, Math.max(barH, 0), RADIUS, 'vertical');
            const color = seriesColor(si);
            return (
              <path
                key={`${ci}-${s.id}`}
                d={path}
                fill={color}
                className="dash-chart-mark-enter"
                style={{ animationDelay: `${(ci * series.length + si) * 12}ms` }}
                onPointerEnter={(evt) => setHover({ categoryIndex: ci, x: evt.clientX, y: evt.clientY })}
                onPointerMove={(evt) => setHover({ categoryIndex: ci, x: evt.clientX, y: evt.clientY })}
                onPointerLeave={() => setHover(null)}
              />
            );
          });
        })}
      </svg>
    );
  };

  const ariaLabel = grouped
    ? `Grouped bar chart “${title}” with ${series.length} series across ${categories.length} categories.`
    : `Bar chart “${title}” across ${categories.length} categories.`;

  const tooltipItems =
    hover != null
      ? series.map((s, si) => ({ label: s.label, value: valueFormat(s.y(data[hover.categoryIndex])), color: seriesColor(si) }))
      : [];

  const tableColumns: Column<Record<string, string>>[] = [
    { key: 'category', label: 'Category' },
    ...series.map((s) => ({ key: s.id, label: s.label })),
  ];
  const tableRows = data.map((d, i) => {
    const row: Record<string, string> = { category: categories[i] };
    for (const s of series) row[s.id] = valueFormat(s.y(d));
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
        legend={grouped ? series.map((s, i) => ({ id: s.id, label: s.label, color: seriesColor(i) })) : undefined}
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
