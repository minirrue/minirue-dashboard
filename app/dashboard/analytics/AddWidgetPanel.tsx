'use client';

import React from 'react';
import type { AnalyticsWidgetDefinition } from '@/lib/analytics/widgets';
import type { LayoutItem } from '@/lib/analytics/layout-store';

/**
 * Edit-mode panel: every registry (+ composed) widget not currently visible,
 * with its description, plus "Reset to default" one click away — both
 * required by the brief regardless of how many widgets are currently hidden.
 */
export interface AddWidgetPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same
  // heterogeneous-registry shape as `lib/analytics/widgets.tsx`.
  widgets: AnalyticsWidgetDefinition<any>[];
  layout: LayoutItem[];
  onAdd: (id: string) => void;
  onReset: () => void;
}

export default function AddWidgetPanel({ widgets, layout, onAdd, onReset }: AddWidgetPanelProps) {
  const placedIds = new Set(layout.filter((item) => item.visible).map((item) => item.id));
  const available = widgets.filter((widget) => !placedIds.has(widget.id));

  return (
    <div className="dash-card dash-widget-add-panel">
      <div className="dash-widget-add-head">
        <p className="dash-section-title" style={{ margin: 0 }}>Add a widget</p>
        <button type="button" className="dash-btn-secondary" onClick={onReset}>
          Reset to default layout
        </button>
      </div>

      {available.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-3)', margin: '8px 0 0' }}>
          Every available widget is already on the board.
        </p>
      ) : (
        <ul className="dash-widget-add-list">
          {available.map((widget) => (
            <li key={widget.id} className="dash-widget-add-row">
              <div style={{ minWidth: 0 }}>
                <p className="dash-widget-add-title">{widget.title}</p>
                <p className="dash-widget-add-desc">{widget.description}</p>
              </div>
              <button
                type="button"
                className="dash-btn-secondary"
                onClick={() => onAdd(widget.id)}
                aria-label={`Add ${widget.title} to the overview`}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
