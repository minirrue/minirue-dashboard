'use client';

import React from 'react';

export interface ChartLegendItem {
  id: string;
  label: string;
  color: string;
  hidden?: boolean;
}

export interface ChartLegendProps {
  items: ChartLegendItem[];
  onToggle?: (id: string) => void;
}

/**
 * Swatch + label, supports click-to-toggle a series. Per DESIGN.md: a legend
 * is only meaningful for ≥ 2 series (a single series is already named by the
 * chart title), so this renders nothing below that — callers don't need to
 * remember the threshold themselves.
 */
export default function ChartLegend({ items, onToggle }: ChartLegendProps) {
  if (items.length < 2) return null;

  return (
    <ul className="dash-chart-legend" role="list">
      {items.map((item) => {
        const interactive = typeof onToggle === 'function';
        return (
          <li key={item.id}>
            <button
              type="button"
              className="dash-chart-legend-item"
              data-hidden={item.hidden ? 'true' : undefined}
              onClick={interactive ? () => onToggle(item.id) : undefined}
              disabled={!interactive}
              aria-pressed={interactive ? !item.hidden : undefined}
            >
              <span className="dash-chart-legend-swatch" style={{ background: item.color }} aria-hidden="true" />
              {/* Legend text always wears --mr-fg-3, never the series colour —
                  the swatch beside it carries identity (DESIGN.md). */}
              <span className="dash-chart-legend-label">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
