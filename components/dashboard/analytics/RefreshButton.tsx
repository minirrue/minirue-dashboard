'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatTime } from '@/lib/dates/format';

/**
 * Refresh one section in place (owner, 2026-09-20: "fresh button instant
 * without refresh, and any section in analytics to refresh without
 * refreshing the whole page").
 *
 * It refetches that section's own data and says when it last did, so a number
 * on screen is never silently stale. Nothing else on the page re-renders, the
 * scroll position stays, and filters stay where they are.
 */
export default function RefreshButton({
  onRefresh,
  label = 'Refresh',
  title = 'Reload just this section',
  compact = false,
}: {
  onRefresh: () => unknown | Promise<unknown>;
  label?: string;
  title?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      if (alive.current) {
        setBusy(false);
        setAt(Date.now());
      }
    }
  }, [busy, onRefresh]);

  return (
    <span className="dash-refresh">
      <button type="button" className="dash-refresh__btn" onClick={() => void run()} disabled={busy} title={title} aria-busy={busy}>
        <span className="dash-refresh__icon" aria-hidden="true" data-spin={busy || undefined}>↻</span>
        {busy ? 'Refreshing…' : label}
      </button>
      {!compact && at !== null && (
        <span className="dash-refresh__at" aria-live="polite">
          updated {formatTime(at)}
        </span>
      )}
    </span>
  );
}

/**
 * Refreshes every react-query analytics query on the current screen — the
 * screens that read through hooks rather than fetching themselves.
 */
export function RefreshScreenButton({ label = 'Refresh', compact }: { label?: string; compact?: boolean }) {
  const client = useQueryClient();
  return (
    <RefreshButton
      label={label}
      compact={compact}
      title="Reload this screen's figures without reloading the page"
      onRefresh={() => client.refetchQueries({ queryKey: ['analytics'], type: 'active' })}
    />
  );
}
