'use client';

import React from 'react';
import { useMeasuredSize, pathFor } from './chart-utils';

export interface SparklineProps {
  values: number[];
  /** CSS colour (var(--mr-...) or hex) — defaults to the brand gold used by
   * DashboardCard's own inline sparkline. */
  color?: string;
  height?: number;
  /** Falls back to the measured container width so the stroke keeps its true
   * pixel width regardless of the card's layout width. */
  fallbackWidth?: number;
}

/**
 * Generalised from the inline sparkline in `OverviewClient.tsx:27-40`
 * (`sparkPoints()`). Deliberately minimal — no axes, no tooltip, no legend —
 * this is a trend glyph, not a chart. Still measures its container rather
 * than assuming a fixed pixel width, so a 2px stroke stays exactly 2px
 * regardless of the card it lands in.
 */
export default function Sparkline({ values, color = 'var(--mr-gold-500)', height = 28, fallbackWidth = 140 }: SparklineProps) {
  const [containerRef, size] = useMeasuredSize({ width: fallbackWidth, height });
  const width = size.width || fallbackWidth;

  if (values.length === 0) {
    return <div ref={containerRef} style={{ width: '100%', height }} aria-hidden="true" />;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pad = 2;
  const usableHeight = height - pad * 2;
  const n = values.length;

  const d =
    n < 2
      ? ''
      : pathFor(
          values,
          (_v, i) => (i / (n - 1)) * width,
          (v) => pad + usableHeight - ((v - min) / span) * usableHeight,
          false,
        );

  const ariaLabel = `Trend of ${n} points, from ${values[0].toLocaleString()} to ${values[n - 1].toLocaleString()}`;

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      <svg
        className="dash-chart-sparkline"
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        {d ? (
          <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
      </svg>
    </div>
  );
}
