import React from 'react';

export interface DashboardCardProps {
  /** Stat label */
  title: string;
  /** Formatted value (e.g. "$12,450") */
  value: string;
  /** Percentage change (e.g. "+12.5" or "-3.2") */
  change?: string;
  /** Trend direction for color coding */
  trend?: 'up' | 'down' | 'flat';
  /** Optional icon node rendered in top-right */
  icon?: React.ReactNode;
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
}: DashboardCardProps) {
  return (
    <div className="dash-card dash-stat-card">
      <div>
        <p className="dash-stat-title">{title}</p>
        <p className="dash-stat-value">{value}</p>
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
