'use client';

import React, { useMemo, useState } from 'react';
import { scaleQuantize } from 'd3-scale';
import ChartFrame from './ChartFrame';
import ChartTooltip from './ChartTooltip';
import { rampColor, RAMP_STEPS, formatCompact } from './chart-utils';
import type { MeasuredSize } from './chart-utils';
import type { Column } from '@/components/dashboard/DashboardTable';

export interface HeatmapCell {
  /** 0 (Sunday) – 6 (Saturday) */
  weekday: number;
  /** 0 – 23 */
  hour: number;
  value: number;
}

export interface HeatmapProps {
  data: HeatmapCell[];
  title: string;
  valueFormat?: (v: number) => string;
  weekdayLabels?: string[];
  animationDelay?: string;
}

const DEFAULT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = 24;
const ROW_HEIGHT = 22;
const MARGIN = { top: 8, right: 12, bottom: 22, left: 34 };

export default function Heatmap({ data, title, valueFormat = formatCompact, weekdayLabels = DEFAULT_WEEKDAYS, animationDelay }: HeatmapProps) {
  const [hover, setHover] = useState<{ weekday: number; hour: number; x: number; y: number } | null>(null);

  const grid = useMemo(() => {
    const lookup = new Map<string, number>();
    for (const cell of data) lookup.set(`${cell.weekday}-${cell.hour}`, cell.value);
    return weekdayLabels.map((_, weekday) =>
      Array.from({ length: HOURS }, (_, hour) => lookup.get(`${weekday}-${hour}`) ?? 0),
    );
  }, [data, weekdayLabels]);

  const values = grid.flat();
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);

  // Five buckets maximum on the ordinal ramp (DESIGN.md) — a colourblind
  // hazard past five adjacent steps on one hue, per the ramp's validation.
  const bucket = useMemo(() => {
    if (max <= min) return () => 0;
    const scale = scaleQuantize<number>()
      .domain([min, max])
      .range(Array.from({ length: RAMP_STEPS }, (_, i) => i));
    return (v: number) => scale(v);
  }, [min, max]);

  const height = MARGIN.top + MARGIN.bottom + weekdayLabels.length * ROW_HEIGHT;

  const renderChart = (size: MeasuredSize) => {
    const width = Math.max(size.width, 40);
    const innerW = Math.max(width - MARGIN.left - MARGIN.right, 1);
    const cellW = innerW / HOURS;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {weekdayLabels.map((label, weekday) => (
          <text key={label} x={MARGIN.left - 8} y={MARGIN.top + weekday * ROW_HEIGHT + ROW_HEIGHT / 2} textAnchor="end" dominantBaseline="middle" className="dash-chart-tick-label">
            {label}
          </text>
        ))}
        {[0, 6, 12, 18, 23].map((hour) => (
          <text key={hour} x={MARGIN.left + hour * cellW + cellW / 2} y={height - 6} textAnchor="middle" className="dash-chart-tick-label">
            {hour}:00
          </text>
        ))}
        {grid.map((row, weekday) =>
          row.map((value, hour) => (
            <rect
              key={`${weekday}-${hour}`}
              x={MARGIN.left + hour * cellW}
              y={MARGIN.top + weekday * ROW_HEIGHT}
              width={Math.max(cellW - 1, 0)}
              height={ROW_HEIGHT - 1}
              fill={rampColor(bucket(value))}
              className="dash-chart-mark-enter"
              style={{ animationDelay: `${(weekday * HOURS + hour) * 1.5}ms` }}
              onPointerEnter={(evt) => setHover({ weekday, hour, x: evt.clientX, y: evt.clientY })}
              onPointerMove={(evt) => setHover({ weekday, hour, x: evt.clientX, y: evt.clientY })}
              onPointerLeave={() => setHover(null)}
            />
          )),
        )}
      </svg>
    );
  };

  const ariaLabel = `Heatmap “${title}” of ${weekdayLabels.length} weekdays by ${HOURS} hours, values from ${valueFormat(min)} to ${valueFormat(max)}.`;

  const hoverValue = hover ? grid[hover.weekday][hover.hour] : 0;
  const tooltipItems = hover
    ? [
        {
          label: `${weekdayLabels[hover.weekday]} ${String(hover.hour).padStart(2, '0')}:00`,
          value: valueFormat(hoverValue),
          color: rampColor(bucket(hoverValue)),
        },
      ]
    : [];

  const tableColumns: Column<{ weekday: string; hour: string; value: string }>[] = [
    { key: 'weekday', label: 'Weekday' },
    { key: 'hour', label: 'Hour' },
    { key: 'value', label: 'Value' },
  ];
  const tableRows = weekdayLabels.flatMap((label, weekday) =>
    grid[weekday].map((value, hour) => ({ weekday: label, hour: `${String(hour).padStart(2, '0')}:00`, value: valueFormat(value) })),
  );

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
