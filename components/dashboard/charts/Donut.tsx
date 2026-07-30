'use client';

import React, { useMemo, useState } from 'react';
import { pie as d3Pie, arc as d3Arc } from 'd3-shape';
import ChartFrame from './ChartFrame';
import ChartTooltip from './ChartTooltip';
import { seriesColor, formatCompact } from './chart-utils';
import type { MeasuredSize } from './chart-utils';
import type { Column } from '@/components/dashboard/DashboardTable';

export interface DonutSlice {
  label: string;
  value: number;
}

export interface DonutProps {
  data: DonutSlice[];
  title: string;
  valueFormat?: (v: number) => string;
  animationDelay?: string;
}

const MAX_SLICES = 5;
const OTHER_COLOR = 'var(--mr-fg-4)';
const OTHER_LABEL = 'Other';

export default function Donut({ data, title, valueFormat = formatCompact, animationDelay }: DonutProps) {
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const hoverIndex = hover?.index ?? null;

  // Max 5 named slices + a folded "Other" for the remainder (DESIGN.md /
  // lane-4 brief) — never an unbounded wedge count that stops reading at a
  // glance.
  const { slices, colors } = useMemo(() => {
    const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    if (sorted.length <= MAX_SLICES) {
      return { slices: sorted, colors: sorted.map((_, i) => seriesColor(i)) };
    }
    const top = sorted.slice(0, MAX_SLICES);
    const rest = sorted.slice(MAX_SLICES).reduce((sum, d) => sum + d.value, 0);
    return {
      slices: [...top, { label: OTHER_LABEL, value: rest }],
      colors: [...top.map((_, i) => seriesColor(i)), OTHER_COLOR],
    };
  }, [data]);

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const renderChart = (size: MeasuredSize) => {
    const width = Math.max(size.width, 40);
    const height = size.height || 220;
    const cx = width / 2;
    const cy = height / 2;
    const outerR = Math.max(Math.min(width, height) / 2 - 8, 1);
    const innerR = outerR * 0.62;

    const pieGen = d3Pie<DonutSlice>()
      .value((d) => d.value)
      .sort(null);
    const arcGen = d3Arc<ReturnType<typeof pieGen>[number]>().innerRadius(innerR).outerRadius(outerR);
    const arcs = pieGen(slices);

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <g transform={`translate(${cx},${cy})`}>
          {arcs.map((a, i) => (
            <path
              key={slices[i].label}
              d={arcGen(a) ?? ''}
              fill={colors[i]}
              stroke="var(--mr-chart-surface)"
              strokeWidth={2}
              opacity={hoverIndex == null || hoverIndex === i ? 1 : 0.55}
              className="dash-chart-mark-enter"
              style={{ animationDelay: `${i * 30}ms`, transformOrigin: 'center' }}
              onPointerEnter={(evt) => setHover({ index: i, x: evt.clientX, y: evt.clientY })}
              onPointerMove={(evt) => setHover({ index: i, x: evt.clientX, y: evt.clientY })}
              onPointerLeave={() => setHover(null)}
            />
          ))}
          {/* Centre carries the total (DESIGN.md). */}
          <text textAnchor="middle" dominantBaseline="middle" y={-6} className="mr-num" style={{ fontSize: 20, fontWeight: 700, fill: 'var(--mr-fg)' }}>
            {valueFormat(total)}
          </text>
          <text textAnchor="middle" dominantBaseline="middle" y={16} className="dash-chart-tick-label">
            Total
          </text>
        </g>
      </svg>
    );
  };

  const ariaLabel = `Donut chart “${title}” with ${slices.length} slices, total ${valueFormat(total)}.`;

  const tooltipItems =
    hoverIndex != null
      ? [
          {
            label: slices[hoverIndex].label,
            value: `${valueFormat(slices[hoverIndex].value)} (${total > 0 ? ((slices[hoverIndex].value / total) * 100).toFixed(1) : '0'}%)`,
            color: colors[hoverIndex],
          },
        ]
      : [];

  const tableColumns: Column<{ label: string; value: string; share: string }>[] = [
    { key: 'label', label: 'Category' },
    { key: 'value', label: 'Value' },
    { key: 'share', label: 'Share' },
  ];
  const tableRows = slices.map((s) => ({
    label: s.label,
    value: valueFormat(s.value),
    share: `${total > 0 ? ((s.value / total) * 100).toFixed(1) : '0'}%`,
  }));

  return (
    <>
      <ChartFrame
        title={title}
        ariaLabel={ariaLabel}
        empty={slices.length === 0}
        height={220}
        animationDelay={animationDelay}
        legend={slices.map((s, i) => ({ id: s.label, label: s.label, color: colors[i] }))}
        table={{ columns: tableColumns, rows: tableRows }}
      >
        {renderChart}
      </ChartFrame>
      {hover ? <ChartTooltip x={hover.x} y={hover.y} visible items={tooltipItems} /> : null}
    </>
  );
}
