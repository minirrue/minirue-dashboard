'use client';

import React, { useState } from 'react';
import type { AnalyticsRangeState, TrafficScope } from '@/lib/hooks/use-analytics';
import { RefreshScreenButton } from './RefreshButton';

const TRAFFIC_OPTIONS: { value: TrafficScope; label: string; hint: string }[] = [
  { value: 'real', label: 'Real only', hint: 'Customers only — bots, staff, the owner and flagged traffic left out' },
  { value: 'all', label: 'Everything', hint: 'Includes bots, staff, the owner and flagged traffic' },
];

/**
 * The one toolbar every Analytics & Media screen shares (dashboard#90, #115):
 * WHEN (range, compare), WHOSE traffic (real only by default), and how much
 * to trust what follows (the quality line, passed in by the screen). It
 * replaces the per-screen date controls, so every screen asks the same
 * question the same way, and the scope travels in the URL between screens.
 */
export default function AnalyticsScopeBar({
  range,
  onChange,
  quality,
  showCompare = true,
}: {
  range: AnalyticsRangeState;
  onChange: (next: Partial<AnalyticsRangeState>) => void;
  /** e.g. "Fresh 2 min ago · 38 excluded" — the screen's own data-quality line. */
  quality?: React.ReactNode;
  showCompare?: boolean;
}) {
  // Phones: one summary line first, controls on tap, so the numbers lead.
  const [open, setOpen] = useState(false);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const summary = `${fmt(range.from)} – ${fmt(range.to)} · ${range.traffic === 'all' ? 'Everything' : 'Real only'}`;

  return (
    <div className="dash-analytics-scope" role="group" aria-label="Report scope" data-open={open || undefined}>
      <button
        type="button"
        className="dash-analytics-scope__summary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{summary}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      <div className="dash-analytics-scope__range">
        <label className="dash-field">
          <span className="dash-label">From</span>
          <input type="date" className="dash-input" value={range.from} max={range.to} onChange={(e) => onChange({ from: e.target.value })} />
        </label>
        <label className="dash-field">
          <span className="dash-label">To</span>
          <input type="date" className="dash-input" value={range.to} min={range.from} onChange={(e) => onChange({ to: e.target.value })} />
        </label>
        {showCompare && (
          <label className="dash-analytics-scope__compare">
            <input type="checkbox" className="dash-checkbox" checked={range.compare} onChange={(e) => onChange({ compare: e.target.checked })} />
            Compare to previous period
          </label>
        )}
      </div>
      <div className="dash-analytics-scope__refresh">
        <RefreshScreenButton compact />
      </div>
      <div className="dash-analytics-scope__traffic">
        <span className="dash-label" id="scope-traffic-label">Traffic</span>
        <div className="dash-segmented" role="radiogroup" aria-labelledby="scope-traffic-label">
          {TRAFFIC_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={range.traffic === o.value}
              data-active={range.traffic === o.value}
              title={o.hint}
              onClick={() => onChange({ traffic: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {quality ? <div className="dash-analytics-scope__quality">{quality}</div> : null}
    </div>
  );
}
