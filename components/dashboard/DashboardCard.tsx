import React from 'react';
import Link from 'next/link';
import Sparkline from './charts/Sparkline';

/**
 * The one stat-card implementation for the dashboard (Lane 12 — folds in
 * `StatCard` from the old `AnalyticsClient.tsx` and `MetricCard` from
 * `OverviewClient.tsx`, both now deleted). Two rendering modes so neither
 * existing look regresses:
 *
 * - Legacy call (only `title`/`value`/`change`/`trend`/`icon`) → the
 *   original horizontal `dash-stat-card` layout, byte-for-byte what this
 *   component already rendered — the real caller (`app/_internal/preview`,
 *   which never passes `icon` either) keeps working unchanged.
 * - Any of `delta`/`sub`/`sparkline`/`href` given → the vertical
 *   `dash-metric` layout lifted from `OverviewClient.tsx` (eyebrow, value +
 *   delta pill, then either an inline sparkline or a sub-line), reusing
 *   `dashboard.css`'s existing `.dash-metric-*` rules rather than inventing
 *   new ones. `href` wraps the card in a `next/link` for the tappable case
 *   (the analytics widget grid composes its own cards through
 *   `AnalyticsWidgetCard` instead, but any other screen wanting a tappable
 *   metric tile can use this directly).
 */
export interface DashboardCardProps {
  /** Stat label (legacy name, kept for the `icon` layout and as the
   * `dash-metric-eyebrow` text in the other). */
  title: string;
  /** Formatted value (e.g. "$12,450") */
  value: string;
  /** Percentage change (e.g. "+12.5" or "-3.2") — legacy prop, has "%"
   * appended automatically. Prefer `delta` for an already-formatted string. */
  change?: string;
  /** Trend direction for color coding */
  trend?: 'up' | 'down' | 'flat';
  /** Optional icon node rendered in top-right — switches the card into the
   * legacy horizontal stat-card layout. */
  icon?: React.ReactNode;
  /** Preformatted delta text (e.g. "+ 12.5%"), rendered as-is. Takes
   * priority over `change` when both are given. */
  delta?: string;
  /** Helper text under the value. Ignored if `sparkline` is given — same
   * slot, sparkline wins. */
  sub?: string;
  /** Raw values for an inline trend glyph. Always rendered through the
   * chart kit's chrome-free `Sparkline` — never draw one by hand per card. */
  sparkline?: number[];
  /** Wraps the whole card in a link — the tappable-card convention. */
  href?: string;
  /** Stable ordinal for a staggered fade-up entrance, matching the
   * dashboard's existing `100 + i * 60` stagger. Omit for no stagger. */
  index?: number;
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'flat') {
    return (
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14" />
      </svg>
    );
  }
  const d = trend === 'up' ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7';
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function DashboardCard({
  title,
  value,
  change,
  trend = 'flat',
  icon,
  delta,
  sub,
  sparkline,
  href,
  index,
}: DashboardCardProps) {
  const style = index != null ? { animationDelay: `${100 + index * 60}ms` } : undefined;

  // Legacy layout — unchanged from the pre-Lane-12 component. Keyed off
  // the *legacy* props (`icon`/`change`) being used, not off the new ones
  // being absent — `OverviewClient`'s cards never set `icon`/`change` at
  // all (they use `delta`/`sub`/`sparkline`), so a sparse-data edge case
  // where those new props all happen to be empty can't accidentally flip a
  // caller into the wrong layout.
  const isLegacyCall = icon !== undefined || change !== undefined;
  if (isLegacyCall) {
    return (
      <div className="dash-card dash-stat-card" style={style}>
        <div>
          <p className="dash-stat-title">{title}</p>
          <p className="dash-stat-value mr-num">{value}</p>
          {change != null && (
            <span className="dash-stat-change" data-trend={trend}>
              <TrendArrow trend={trend} />
              {change}%
            </span>
          )}
        </div>
        {icon && <div className="dash-stat-icon">{icon}</div>}
      </div>
    );
  }

  const deltaText = delta ?? (change != null ? `${change}%` : null);

  const inner = (
    <>
      <div className="dash-metric-eyebrow">{title}</div>
      <div className="dash-metric-row">
        <div className="dash-metric-value mr-num">{value}</div>
        {deltaText != null ? (
          <span className="dash-metric-delta" data-trend={trend}>
            <TrendArrow trend={trend} />
            {deltaText}
          </span>
        ) : null}
      </div>
      {sparkline && sparkline.length > 0 ? (
        <div className="dash-metric-spark">
          <Sparkline
            values={sparkline}
            color={trend === 'down' ? 'var(--mr-crimson-500)' : 'var(--mr-gold-500)'}
            height={28}
          />
        </div>
      ) : sub != null ? (
        <div className="dash-metric-sub">{sub}</div>
      ) : (
        <div style={{ height: 28 }} />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="dash-card dash-metric" style={{ ...style, textDecoration: 'none' }}>
        {inner}
      </Link>
    );
  }

  return (
    <div className="dash-card dash-metric" style={style}>
      {inner}
    </div>
  );
}
