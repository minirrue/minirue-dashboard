'use client';

import { useEffect, useState } from 'react';

/** How often the label re-checks the clock. */
const TICK_MS = 30_000;

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

/**
 * "just now" / "7 minutes ago" for an ISO timestamp, kept honest by a timer.
 *
 * Nine analytics screens each carried this inline:
 *
 *   const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(x).getTime()) / 60_000));
 *
 * Two problems with that, and the linter only names the first:
 *
 * 1. `Date.now()` during render is impure — the same props produce a different
 *    result each time, which is what react-hooks/purity objects to and what the
 *    React Compiler is entitled to assume does not happen.
 *
 * 2. More visibly: the label never changed on its own. It was recomputed only
 *    when something ELSE re-rendered the screen, so a dashboard left open said
 *    "Updated just now" for as long as nobody touched it — on a freshness
 *    indicator, whose entire job is telling the operator how stale the numbers
 *    are. The one label you must be able to trust was the one that lied.
 *
 * Reading the clock in an effect fixes the purity complaint; the interval is
 * what makes the answer true a minute later.
 *
 * Returns `null` for a null/empty timestamp so callers can render nothing,
 * and computes the first value in the effect so server and client agree on the
 * initial HTML.
 */
export function useMinutesAgoLabel(iso: string | null | undefined): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) {
      setLabel(null);
      return;
    }

    const update = () => {
      const minutesAgo = minutesSince(iso);
      setLabel(
        minutesAgo === 0
          ? 'just now'
          : `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`,
      );
    };

    update();
    const id = setInterval(update, TICK_MS);
    return () => clearInterval(id);
  }, [iso]);

  return label;
}

/**
 * The same clock reading as a NUMBER, for callers that compare it to a
 * threshold rather than print it — DevOpsClient treats "behind by 15 minutes"
 * as degraded.
 *
 * `null` until the first effect runs (and for a null timestamp), so a caller
 * rendering a health pill shows "unknown" for one frame rather than briefly
 * claiming everything is fine.
 */
export function useMinutesAgo(iso: string | null | undefined): number | null {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!iso) {
      setMinutes(null);
      return;
    }
    const update = () => setMinutes(minutesSince(iso));
    update();
    const id = setInterval(update, TICK_MS);
    return () => clearInterval(id);
  }, [iso]);

  return minutes;
}
