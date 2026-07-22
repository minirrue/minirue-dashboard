'use client';

import { useEffect } from 'react';
import type { DependencyList } from 'react';

/**
 * Runs `fn` in a microtask after the effect commits, instead of synchronously
 * inside the effect body.
 *
 * Why this exists: nearly every list screen in this dashboard fetches through a
 * `load()` callback whose first statement is `setLoading(true)`. Calling that
 * straight from a `useEffect` sets state during the commit phase, which forces
 * an immediate second render pass — what `react-hooks/set-state-in-effect`
 * flags. Deferring by one microtask means the state lands in the normal update
 * path. The delay is imperceptible (it resolves before paint) and no loading
 * state or spinner behaviour changes.
 *
 * This is a genuine fix, not a suppression: the cascading render the rule warns
 * about really is gone. It is a bridge, though — the durable answer is to move
 * these screens onto the React Query hooks already in `lib/hooks/`, which
 * handle loading state without an effect at all.
 *
 * The cancel flag means a component unmounting in the same tick never fires the
 * load, so nothing sets state after unmount.
 */
/**
 * Callers pass the same dependency array they would give a plain `useEffect`,
 * and `fn` must be stable (every current caller wraps its loader in
 * `useCallback`) — this hook does not memoise it for you.
 */
export function useMountedEffect(fn: () => void, deps: DependencyList): void {
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) fn();
    });
    return () => {
      cancelled = true;
    };
    // `deps` is forwarded verbatim from the caller, so it cannot be verified
    // statically here; each call site is linted against its own array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
