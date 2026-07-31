'use client';

import React, { useState } from 'react';
import ChartFrame from './ChartFrame';
import ChartTooltip from './ChartTooltip';
import { rampColor, roundedBarPath, formatCompact } from './chart-utils';
import type { MeasuredSize } from './chart-utils';
import type { Column } from '@/components/dashboard/DashboardTable';

export interface FunnelStage {
  label: string;
  value: number;
}

export interface FunnelProps {
  stages: FunnelStage[];
  title: string;
  valueFormat?: (v: number) => string;
  animationDelay?: string;
}

const MARGIN = { top: 8, right: 12, bottom: 8, left: 8 };
const ROW_HEIGHT = 48;
const BAR_HEIGHT = 16;
const RADIUS = 4;

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/**
 * Ordered stages use the ordinal ramp, never categorical hues — reordering
 * stages would change what the chart means (DESIGN.md / lane-4 brief), so
 * colour must track position, not identity.
 */
export default function Funnel({ stages, title, valueFormat = formatCompact, animationDelay }: FunnelProps) {
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  const first = stages[0]?.value ?? 0;
  const height = MARGIN.top + MARGIN.bottom + Math.max(stages.length, 1) * ROW_HEIGHT;

  const renderChart = (size: MeasuredSize) => {
    const width = Math.max(size.width, 40);
    const innerW = Math.max(width - MARGIN.left - MARGIN.right, 1);

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {stages.map((stage, i) => {
          const rateFromStart = first > 0 ? (stage.value / first) * 100 : 0;
          const dropOff = i > 0 && stages[i - 1].value > 0 ? ((stages[i - 1].value - stage.value) / stages[i - 1].value) * 100 : null;
          const barW = Math.max((rateFromStart / 100) * innerW, 1);
          const rowTop = MARGIN.top + i * ROW_HEIGHT;
          const barY = rowTop + 22;
          const path = roundedBarPath(MARGIN.left, barY, barW, BAR_HEIGHT, RADIUS, 'horizontal');
          return (
            <g
              key={stage.label}
              className="dash-chart-mark-enter"
              style={{ animationDelay: `${i * 40}ms` }}
              onPointerEnter={(evt) => setHover({ index: i, x: evt.clientX, y: evt.clientY })}
              onPointerMove={(evt) => setHover({ index: i, x: evt.clientX, y: evt.clientY })}
              onPointerLeave={() => setHover(null)}
            >
              <text x={MARGIN.left} y={rowTop + 12} className="dash-chart-tick-label" style={{ fill: 'var(--mr-fg-2)' }}>
                {stage.label}
              </text>
              <path d={path} fill={rampColor(i)} />
              <text x={MARGIN.left + barW + 8} y={barY + BAR_HEIGHT / 2} dominantBaseline="middle" className="dash-chart-tick-label mr-num">
                {valueFormat(stage.value)} · {pct(rateFromStart)}
                {dropOff != null ? ` · −${pct(dropOff)}` : ''}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const ariaLabel = `Funnel chart “${title}” with ${stages.length} stages, from ${valueFormat(first)} to ${valueFormat(
    stages[stages.length - 1]?.value ?? 0,
  )}.`;

  const tooltipItems =
    hover != null
      ? (() => {
          const stage = stages[hover.index];
          const rateFromStart = first > 0 ? (stage.value / first) * 100 : 0;
          const dropOff =
            hover.index > 0 && stages[hover.index - 1].value > 0
              ? ((stages[hover.index - 1].value - stage.value) / stages[hover.index - 1].value) * 100
              : null;
          return [
            { label: 'Count', value: valueFormat(stage.value), color: rampColor(hover.index) },
            { label: 'Rate from start', value: pct(rateFromStart) },
            ...(dropOff != null ? [{ label: 'Drop-off', value: pct(dropOff) }] : []),
          ];
        })()
      : [];

  const tableColumns: Column<{ stage: string; count: string; rate: string; dropOff: string }>[] = [
    { key: 'stage', label: 'Stage' },
    { key: 'count', label: 'Count' },
    { key: 'rate', label: 'Rate from start' },
    { key: 'dropOff', label: 'Drop-off' },
  ];
  const tableRows = stages.map((stage, i) => {
    const rateFromStart = first > 0 ? (stage.value / first) * 100 : 0;
    const dropOff = i > 0 && stages[i - 1].value > 0 ? ((stages[i - 1].value - stage.value) / stages[i - 1].value) * 100 : null;
    return {
      stage: stage.label,
      count: valueFormat(stage.value),
      rate: pct(rateFromStart),
      dropOff: dropOff != null ? pct(dropOff) : '—',
    };
  });

  return (
    <>
      <ChartFrame
        title={title}
        ariaLabel={ariaLabel}
        empty={stages.length === 0}
        height={height}
        animationDelay={animationDelay}
        table={{ columns: tableColumns, rows: tableRows }}
      >
        {renderChart}
      </ChartFrame>
      {hover ? <ChartTooltip x={hover.x} y={hover.y} visible title={stages[hover.index].label} items={tooltipItems} /> : null}
    </>
  );
}
