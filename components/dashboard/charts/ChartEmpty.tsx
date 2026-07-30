'use client';

import React from 'react';

export interface ChartEmptyProps {
  /** Honest, specific message — never sample/placeholder data (DESIGN.md bans
   * fabricated metric data outright; this is the alternative to it). */
  message?: string;
  height?: number;
}

export default function ChartEmpty({ message = 'No data for this period.', height = 220 }: ChartEmptyProps) {
  return (
    <div className="dash-chart-empty" style={{ height }}>
      <span>{message}</span>
    </div>
  );
}
