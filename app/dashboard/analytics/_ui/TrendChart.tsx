'use client';

import React, { useState } from 'react';
import { dayLabel, fmtInt } from '@/lib/analytics/format';

/**
 * Visitors per day: a line over a soft area, a faint grid, the last day
 * marked, and the exact value on hover, focus (arrow keys) or tap. With
 * fewer than four days a chart says nothing a number doesn't, so it shows
 * the numbers instead.
 */
export default function TrendChart({ data }: { data: { day: string; visitors: number }[] }) {
  const [at, setAt] = useState<number | null>(null);
  if (data.length < 4) {
    return (
      <p className="anx-p">
        {data.length
          ? data.map((d) => `${dayLabel(d.day)}: ${fmtInt(d.visitors)}`).join(' · ')
          : 'No days with visitors in this range.'}
      </p>
    );
  }
  const W = 560;
  const H = 170;
  const pl = 30;
  const pr = 12;
  const pt = 12;
  const pb = 24;
  const peak = Math.max(...data.map((d) => d.visitors));
  const max = Math.max(4, Math.ceil(peak / 4) * 4);
  const step = (W - pl - pr) / (data.length - 1);
  const x = (i: number) => pl + i * step;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const pts = data.map((d, i) => [x(i), y(d.visitors)] as const);
  const line = `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}`;
  const area = `${line}L${x(data.length - 1)} ${H - pb}L${pl} ${H - pb}Z`;
  const ticks = [0, max / 2, max];
  const labelIdx = [0, Math.round((data.length - 1) / 3), Math.round(((data.length - 1) * 2) / 3), data.length - 1];
  const peakIdx = data.findIndex((d) => d.visitors === peak);
  const last = pts[pts.length - 1];
  const active = at !== null ? data[at] : null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setAt((i) => Math.min(data.length - 1, (i ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setAt((i) => Math.max(0, (i ?? data.length) - 1));
    else if (e.key === 'Escape') setAt(null);
    else return;
    e.preventDefault();
  };
  return (
    <>
      <svg
        className="anx-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={`Visitors per day, ${dayLabel(data[0].day)} to ${dayLabel(data[data.length - 1].day)}. Peak ${fmtInt(peak)} on ${dayLabel(data[peakIdx].day)}. Use the arrow keys to read each day.`}
        onKeyDown={onKey}
        onBlur={() => setAt(null)}
        onMouseLeave={() => setAt(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="anx-grid" x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} />
            <text x={pl - 6} y={y(t) + 4} textAnchor="end">
              {fmtInt(t)}
            </text>
          </g>
        ))}
        <path className="anx-area" d={area} />
        <path className="anx-line" d={line} />
        {[...new Set(labelIdx)].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
            {dayLabel(data[i].day)}
          </text>
        ))}
        {at !== null ? <line className="anx-cursor" x1={x(at)} x2={x(at)} y1={pt} y2={H - pb} /> : null}
        <circle className="anx-end" cx={last[0]} cy={last[1]} r={4} />
        {at !== null ? <circle className="anx-end" cx={pts[at][0]} cy={pts[at][1]} r={4} /> : null}
        {pts.map((p, i) => (
          <rect
            key={data[i].day}
            className="anx-hit"
            x={p[0] - step / 2}
            y={pt}
            width={step}
            height={H - pt - pb}
            onMouseEnter={() => setAt(i)}
            onClick={() => setAt(i)}
          />
        ))}
      </svg>
      <p className="anx-chart-tip" aria-live="polite">
        {active ? (
          <>
            {dayLabel(active.day, true)}: <b className="anx-num">{fmtInt(active.visitors)}</b> visitors
          </>
        ) : (
          <>Hover, tap or use the arrow keys for each day.</>
        )}
      </p>
    </>
  );
}
