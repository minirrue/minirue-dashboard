'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { ticks as d3Ticks } from 'd3-array';
import { line as d3Line, curveMonotoneX, curveLinear } from 'd3-shape';

/* ── Measured size ──────────────────────────────────────────────────────
 * Every chart renders into a viewBox sized from its container, never a fixed
 * pixel width (DESIGN.md / lane-4 brief). ResizeObserver does the measuring;
 * jsdom (and older browsers) don't implement it, so this falls back to a
 * single getBoundingClientRect() read rather than throwing — that keeps the
 * render-smoke tests honest about "does this crash" without needing a
 * polyfill this lane doesn't own (jest.setup.ts belongs to another lane).
 */

export interface MeasuredSize {
  width: number;
  height: number;
}

export function useMeasuredSize<T extends HTMLElement = HTMLDivElement>(
  fallback: MeasuredSize = { width: 320, height: 200 },
): [RefObject<T | null>, MeasuredSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<MeasuredSize>(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof ResizeObserver === 'undefined') {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
      return;
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}

/* ── Categorical colour slots ────────────────────────────────────────────
 * Indexes the fixed --mr-chart-1..8 tokens declared in styles/mr-tokens.css.
 * Their order passed a six-check colourblind/contrast validation — never
 * reorder them and never cycle back to slot 1 for a 9th series. A wrapped
 * 9th series would render identically to the 1st and silently misrepresent
 * the data, so this throws instead of wrapping.
 */

const CATEGORICAL_SLOTS = 8;

export function seriesColor(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= CATEGORICAL_SLOTS) {
    throw new RangeError(
      `seriesColor: index ${index} is out of range — only ${CATEGORICAL_SLOTS} validated ` +
        'categorical chart colours exist (indices 0-7). Fold extra series into an "Other" ' +
        'slot instead of adding a 9th colour or cycling back to slot 1.',
    );
  }
  return `var(--mr-chart-${index + 1})`;
}

/**
 * Non-throwing variant for call sites that must render an unbounded list
 * (e.g. Donut folding long tails into "Other"): returns seriesColor(index)
 * for index < 8 and a neutral "Other" colour beyond it, rather than
 * reusing/cycling a series colour.
 */
export function seriesColorOrOther(index: number): string {
  if (index >= 0 && index < CATEGORICAL_SLOTS) return seriesColor(index);
  return 'var(--mr-fg-4)';
}

/* ── Ordinal / sequential ramp ────────────────────────────────────────────
 * Indexes the fixed --mr-chart-ramp-1..5 tokens. Five steps is the ceiling
 * (see styles/mr-tokens.css comment) — this clamps rather than extends past
 * step 5, so a 6th funnel stage or heatmap bucket darkens no further instead
 * of inventing an unvalidated 6th colour.
 */

const RAMP_STEPS = 5;

export function rampColor(index: number): string {
  const clamped = Math.min(Math.max(Math.trunc(index), 0), RAMP_STEPS - 1);
  return `var(--mr-chart-ramp-${clamped + 1})`;
}

export { RAMP_STEPS };

/* ── Formatting ──────────────────────────────────────────────────────── */

/** Formats a minor-unit (cents) EGP amount as a full, non-abbreviated figure. */
export function formatEgpMinor(minorUnits: number): string {
  if (!Number.isFinite(minorUnits)) return 'EGP 0.00';
  const value = minorUnits / 100;
  return `EGP ${value.toLocaleString('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Compacts a plain (non-money) count for axis ticks and dense labels. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(value)}`;
}

/* ── Ticks ───────────────────────────────────────────────────────────── */

/**
 * Nice, evenly-spaced tick values for a [min, max] domain. Handles the
 * awkward ranges real analytics data produces:
 *  - min === max (all-zero series, or a single data point) — d3's `ticks`
 *    divides by the domain span, so a zero-span domain is padded first.
 *  - negative ranges — d3-array's ticks() already supports these natively.
 *  - very large ranges — ticks() picks human-friendly steps (1/2/5 × 10^n)
 *    regardless of magnitude.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];

  let lo = Math.min(min, max);
  let hi = Math.max(min, max);

  if (lo === hi) {
    if (lo === 0) {
      hi = 1;
    } else {
      const pad = Math.abs(lo) * 0.1 + 1;
      lo -= pad;
      hi += pad;
    }
  }

  const result = d3Ticks(lo, hi, Math.max(1, count));
  return result.length > 0 ? result : [lo, hi];
}

/* ── Path generation ─────────────────────────────────────────────────── */

/** Wraps d3-shape's line generator with a sensible default curve and a
 * `defined()` guard so non-finite points break the line instead of drawing
 * through the origin. */
export function pathFor<T>(
  data: T[],
  x: (d: T, i: number) => number,
  y: (d: T, i: number) => number,
  curved = true,
): string {
  const gen = d3Line<T>()
    .x(x)
    .y(y)
    .curve(curved ? curveMonotoneX : curveLinear)
    .defined((d, i) => Number.isFinite(x(d, i)) && Number.isFinite(y(d, i)));
  return gen(data) ?? '';
}

/**
 * Builds a bar path rounded 4px only on the data-end, never on the baseline
 * end (DESIGN.md: "bar/segment data-ends rounded 4px and anchored to the
 * baseline (never rounded on both ends)"). A fully-rounded bar reads as a
 * pill/badge rather than a magnitude mark.
 */
export function roundedBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  orientation: 'vertical' | 'horizontal' = 'vertical',
): string {
  if (width <= 0 || height <= 0) return '';
  const maxR = orientation === 'vertical' ? Math.min(width / 2, height) : Math.min(height / 2, width);
  const r = Math.max(0, Math.min(radius, maxR));

  if (r <= 0) {
    return `M${x},${y} h${width} v${height} h${-width} Z`;
  }

  if (orientation === 'vertical') {
    // Baseline sits at y + height (the bottom); round the top-left/top-right corners only.
    return [
      `M${x},${y + height}`,
      `V${y + r}`,
      `Q${x},${y} ${x + r},${y}`,
      `H${x + width - r}`,
      `Q${x + width},${y} ${x + width},${y + r}`,
      `V${y + height}`,
      'Z',
    ].join(' ');
  }

  // Horizontal: baseline sits at x (the left edge); round the right end only.
  return [
    `M${x},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height - r}`,
    `Q${x + width},${y + height} ${x + width - r},${y + height}`,
    `H${x}`,
    'Z',
  ].join(' ');
}
