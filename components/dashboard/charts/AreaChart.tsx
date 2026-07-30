'use client';

import React, { useMemo, useState } from 'react';
import { area as d3Area, curveMonotoneX } from 'd3-shape';
import ChartFrame from './ChartFrame';
import ChartTooltip from './ChartTooltip';
import { seriesColor, niceTicks, formatCompact } from './chart-utils';
import type { MeasuredSize } from './chart-utils';
import type { Column } from '@/components/dashboard/DashboardTable';

export interface AreaChartSeries<T> {
  id: string;
  label: string;
  y: (d: T) => number | null | undefined;
}

export interface AreaChartProps<T> {
  data: T[];
  xLabel: (d: T, i: number) => string;
  /** One entry = single flat-fill area. Two or more = stacked bands, drawn
   * in array order (bottom to top). */
  series: AreaChartSeries<T>[];
  title: string;
  height?: number;
  valueFormat?: (v: number) => string;
  animationDelay?: string;
}

const MARGIN = { top: 12, right: 12, bottom: 24, left: 44 };
const FILL_OPACITY = 0.22;

export default function AreaChart<T>({
  data,
  xLabel,
  series,
  title,
  height = 220,
  valueFormat = formatCompact,
  animationDelay,
}: AreaChartProps<T>) {
  const stacked = series.length > 1;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  // Per-point cumulative stack (single series is just its own value).
  const stacks = useMemo(
    () =>
      data.map((d) => {
        let running = 0;
        return series.map((s) => {
          const v = s.y(d) ?? 0;
          const from = running;
          running += Math.max(v, 0);
          return { from, to: running, raw: v };
        });
      }),
    [data, series],
  );

  const maxTotal = Math.max(1, ...stacks.map((row) => row[row.length - 1]?.to ?? 0));
  const ticks = niceTicks(0, maxTotal, 4);
  const domainMax = Math.max(maxTotal, ticks[ticks.length - 1] ?? maxTotal);

  const renderChart = (size: MeasuredSize) => {
    const width = Math.max(size.width, 40);
    const innerW = Math.max(width - MARGIN.left - MARGIN.right, 1);
    const innerH = Math.max(height - MARGIN.top - MARGIN.bottom, 1);
    const n = data.length;

    const xAt = (i: number) => MARGIN.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (v: number) => MARGIN.top + innerH - (v / (domainMax || 1)) * innerH;
    const labelEvery = Math.max(1, Math.ceil(n / 6));

    const handleMove = (evt: React.PointerEvent<SVGSVGElement>) => {
      if (n === 0) return;
      const rect = evt.currentTarget.getBoundingClientRect();
      const ratio = n <= 1 ? 0 : (evt.clientX - rect.left - MARGIN.left) / innerW;
      const idx = Math.min(Math.max(Math.round(ratio * (n - 1)), 0), n - 1);
      setHoverIndex(idx);
      setPointer({ x: evt.clientX, y: evt.clientY });
    };
    const handleLeave = () => {
      setHoverIndex(null);
      setPointer(null);
    };

    const areaGen = d3Area<{ from: number; to: number }>()
      .x((_d, i) => xAt(i))
      .y0((d) => yAt(d.from))
      .y1((d) => yAt(d.to))
      .curve(curveMonotoneX);

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} onPointerMove={handleMove} onPointerLeave={handleLeave}>
        {ticks.map((t) => (
          <line key={t} x1={MARGIN.left} x2={width - MARGIN.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--mr-chart-grid)" strokeWidth={1} />
        ))}
        {ticks.map((t) => (
          <text key={`l-${t}`} x={MARGIN.left - 8} y={yAt(t)} textAnchor="end" dominantBaseline="middle" className="dash-chart-tick-label">
            {valueFormat(t)}
          </text>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={`x-${i}`} x={xAt(i)} y={height - 6} textAnchor="middle" className="dash-chart-tick-label">
              {xLabel(d, i)}
            </text>
          ) : null,
        )}

        {series.map((s, si) => {
          const band = stacks.map((row) => row[si]);
          const color = seriesColor(si);
          const path = areaGen(band) ?? '';
          const topPath = band
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(p.to)}`)
            .join(' ');
          return (
            <g key={s.id} className="dash-chart-mark-enter" style={{ animationDelay: `${si * 40}ms` }}>
              <path d={path} fill={color} fillOpacity={FILL_OPACITY} stroke="none" />
              <path d={topPath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}

        {hoverIndex != null ? (
          <line x1={xAt(hoverIndex)} x2={xAt(hoverIndex)} y1={MARGIN.top} y2={height - MARGIN.bottom} stroke="var(--mr-chart-axis)" strokeWidth={1} strokeDasharray="3 3" />
        ) : null}
      </svg>
    );
  };

  const ariaLabel = stacked
    ? `Stacked area chart “${title}” with ${series.length} series across ${data.length} points.`
    : `Area chart “${title}” across ${data.length} points.`;

  const tooltipItems =
    hoverIndex != null
      ? series.map((s, si) => ({
          label: s.label,
          value: valueFormat(stacks[hoverIndex][si].raw),
          color: seriesColor(si),
        }))
      : [];

  const tableColumns: Column<Record<string, string>>[] = [
    { key: 'x', label: 'Period' },
    ...series.map((s) => ({ key: s.id, label: s.label })),
  ];
  const tableRows = data.map((d, i) => {
    const row: Record<string, string> = { x: xLabel(d, i) };
    series.forEach((s, si) => {
      row[s.id] = valueFormat(stacks[i][si].raw);
    });
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
        legend={stacked ? series.map((s, i) => ({ id: s.id, label: s.label, color: seriesColor(i) })) : undefined}
        table={{ columns: tableColumns, rows: tableRows }}
      >
        {renderChart}
      </ChartFrame>
      {hoverIndex != null && pointer ? (
        <ChartTooltip x={pointer.x} y={pointer.y} visible title={xLabel(data[hoverIndex], hoverIndex)} items={tooltipItems} />
      ) : null}
    </>
  );
}
