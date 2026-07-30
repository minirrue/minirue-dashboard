'use client';

import React, { useMemo } from 'react';

export interface ChartTooltipItem {
  label: string;
  value: string;
  color?: string;
}

export interface ChartTooltipProps {
  /** Pointer position in viewport (client) coordinates. */
  x: number;
  y: number;
  visible: boolean;
  title?: string;
  items: ChartTooltipItem[];
}

const OFFSET = 14;
const EDGE_MARGIN = 12;
// Rough tooltip footprint used to decide whether it needs to flip near an
// edge — exact size doesn't matter, this only needs to be conservative
// enough to keep the box on-screen.
const ASSUMED_WIDTH = 220;
const ASSUMED_HEIGHT = 140;

/**
 * `position: fixed` so the tooltip escapes any `overflow: hidden` ancestor
 * (a chart card clips its own SVG). Follows the pointer and flips away from
 * whichever edge it would otherwise overflow.
 */
export default function ChartTooltip({ x, y, visible, title, items }: ChartTooltipProps) {
  const style = useMemo<React.CSSProperties>(() => {
    if (typeof window === 'undefined') {
      return { left: x + OFFSET, top: y + OFFSET };
    }
    const flipX = x + OFFSET + ASSUMED_WIDTH > window.innerWidth - EDGE_MARGIN;
    const flipY = y + OFFSET + ASSUMED_HEIGHT > window.innerHeight - EDGE_MARGIN;
    return {
      left: flipX ? x - OFFSET : x + OFFSET,
      top: flipY ? y - OFFSET : y + OFFSET,
      transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
    };
  }, [x, y]);

  if (!visible || items.length === 0) return null;

  return (
    <div className="dash-chart-tooltip" style={{ position: 'fixed', ...style }} role="tooltip">
      {title ? <div className="dash-chart-tooltip-title">{title}</div> : null}
      {items.map((item, i) => (
        <div className="dash-chart-tooltip-row" key={`${item.label}-${i}`}>
          {item.color ? (
            <span className="dash-chart-tooltip-swatch" style={{ background: item.color }} aria-hidden="true" />
          ) : null}
          <span className="dash-chart-tooltip-label">{item.label}</span>
          <span className="dash-chart-tooltip-value mr-num">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
