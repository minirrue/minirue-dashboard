'use client';

import React from 'react';

export interface ChartSkeletonProps {
  height?: number;
}

/** Loading placeholder built from the existing `.dash-skeleton` shimmer class
 * used elsewhere in the dashboard — no bespoke skeleton treatment for charts. */
export default function ChartSkeleton({ height = 220 }: ChartSkeletonProps) {
  return (
    <div className="dash-chart-skeleton" style={{ height }} aria-hidden="true">
      <span className="dash-skeleton" style={{ width: '40%', height: 12 }} />
      <span className="dash-skeleton" style={{ width: '100%', height: '100%', marginTop: 10 }} />
    </div>
  );
}
