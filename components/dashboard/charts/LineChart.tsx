'use client';

import React, { useMemo, useState } from 'react';
import ChartFrame from './ChartFrame';
import ChartTooltip from './ChartTooltip';
import { seriesColor, pathFor, niceTicks, formatCompact } from './chart-utils';
import type { MeasuredSize } from './chart-utils';
import type { Column } from '@/components/dashboard/DashboardTable';

export interface LineChartSeries<T> {
  id: string;
  label: string;
  y: (d: T) => number | null | undefined;
}

export interface LineChartProps<T> {
  data: T[];
  /** Label for each point's x position — an index/category/date string, used
   * for ticks, the crosshair readout and the table view. Never plotted as a
   * numeric scale; points are placed at even intervals (this kit treats x as
   * ordinal, matching the categorical data every dashboard series actually
   * has — daily/weekly buckets). */
  xLabel: (d: T, i: number) => string;
  series: LineChartSeries<T>[];
  title: string;
  height?: number;
  valueFormat?: (v: number) => string;
  animationDelay?: string;
}

const MARGIN = { top: 12, right: 12, bottom: 24, left: 44 };

export default function LineChart<T>({
  data,
  xLabel,
  series,
  title,
  height = 240,
  valueFormat = formatCompact,
  animationDelay,
}: LineChartProps<T>) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const visibleSeries = series.filter((s) => !hidden.has(s.id));

  const values = useMemo(
    () =>
      data.flatMap((d) =>
        visibleSeries.map((s) => {
          const v = s.y(d);
          return v == null ? NaN : v;
        }),
      ),
    [data, visibleSeries],
  );
  const finiteValues = values.filter((v) => Number.isFinite(v));
  const yMin = finiteValues.length ? Math.min(0, ...finiteValues) : 0;
  const yMax = finiteValues.length ? Math.max(...finiteValues) : 1;
  const ticks = niceTicks(yMin, yMax, 4);
  const domainMin = Math.min(yMin, ticks[0] ?? yMin);
  const domainMax = Math.max(yMax, ticks[ticks.length - 1] ?? yMax);

  const renderChart = (size: MeasuredSize) => {
    const width = Math.max(size.width, 40);
    const innerW = Math.max(width - MARGIN.left - MARGIN.right, 1);
    const innerH = Math.max(height - MARGIN.top - MARGIN.bottom, 1);
    const n = data.length;

    const xAt = (i: number) => MARGIN.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (v: number) => {
      const span = domainMax - domainMin || 1;
      return MARGIN.top + innerH - ((v - domainMin) / span) * innerH;
    };

    // Show at most ~6 x-axis labels — selective direct labels, never one per point.
    const labelEvery = Math.max(1, Math.ceil(n / 6));

    const handleMove = (evt: React.PointerEvent<SVGSVGElement>) => {
      if (n === 0) return;
      const rect = evt.currentTarget.getBoundingClientRect();
      const localX = evt.clientX - rect.left;
      const ratio = n <= 1 ? 0 : (localX - MARGIN.left) / innerW;
      const idx = Math.round(ratio * (n - 1));
      setHoverIndex(Math.min(Math.max(idx, 0), n - 1));
      setPointer({ x: evt.clientX, y: evt.clientY });
    };
    const handleLeave = () => {
      setHoverIndex(null);
      setPointer(null);
    };

    return (
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
      >
        {/* Recessive gridlines */}
        {ticks.map((t) => (
          <line
            key={t}
            x1={MARGIN.left}
            x2={width - MARGIN.right}
            y1={yAt(t)}
            y2={yAt(t)}
            stroke="var(--mr-chart-grid)"
            strokeWidth={1}
          />
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

        {/* Crosshair */}
        {hoverIndex != null ? (
          <line x1={xAt(hoverIndex)} x2={xAt(hoverIndex)} y1={MARGIN.top} y2={height - MARGIN.bottom} stroke="var(--mr-chart-axis)" strokeWidth={1} strokeDasharray="3 3" />
        ) : null}

        {visibleSeries.map((s, si) => {
          const color = seriesColor(series.findIndex((orig) => orig.id === s.id));
          const points = data.map((d, i) => ({ i, v: s.y(d) }));
          const d = pathFor(
            points,
            (p) => xAt(p.i),
            (p) => yAt(p.v ?? domainMin),
          );
          return (
            <g key={s.id} className="dash-chart-mark-enter" style={{ animationDelay: `${si * 40}ms` }}>
              <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {hoverIndex != null && points[hoverIndex]?.v != null ? (
                <>
                  {/* Invisible ≥8px hit target around the visible dot. */}
                  <circle cx={xAt(hoverIndex)} cy={yAt(points[hoverIndex].v as number)} r={8} fill="transparent" />
                  <circle
                    cx={xAt(hoverIndex)}
                    cy={yAt(points[hoverIndex].v as number)}
                    r={3.5}
                    fill={color}
                    stroke="var(--mr-chart-surface)"
                    strokeWidth={2}
                  />
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    );
  };

  const ariaLabel = `Line chart “${title}” with ${series.length} series across ${data.length} points.`;

  const tooltipItems =
    hoverIndex != null
      ? visibleSeries.map((s) => {
          const v = s.y(data[hoverIndex]);
          return {
            label: s.label,
            value: v == null ? '—' : valueFormat(v),
            color: seriesColor(series.findIndex((orig) => orig.id === s.id)),
          };
        })
      : [];

  const tableColumns: Column<Record<string, string>>[] = [
    { key: 'x', label: 'Period' },
    ...series.map((s) => ({ key: s.id, label: s.label })),
  ];
  const tableRows = data.map((d, i) => {
    const row: Record<string, string> = { x: xLabel(d, i) };
    for (const s of series) {
      const v = s.y(d);
      row[s.id] = v == null ? '—' : valueFormat(v);
    }
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
        legend={series.map((s, i) => ({ id: s.id, label: s.label, color: seriesColor(i), hidden: hidden.has(s.id) }))}
        onLegendToggle={(id) =>
          setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
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
