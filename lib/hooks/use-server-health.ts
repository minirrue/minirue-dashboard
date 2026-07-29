'use client';

import { useEffect, useState } from 'react';
import { checkServerHealth, type ServerHealth } from '@/lib/api/health';

export interface ServerHealthSnapshot {
  /** null until the first probe answers — "checking", not "healthy". */
  status: ServerHealth | null;
  /** Epoch ms of the last completed probe, for a "checked N ago" hint. */
  checkedAt: number | null;
}

export interface ServerHealthState extends ServerHealthSnapshot {
  /** Probe now, e.g. when the user clicks the indicator. */
  refresh: () => void;
}

const POLL_MS = 20_000;

/**
 * ONE poller for the whole app, not one per indicator.
 *
 * The status is shown in more than one place at once — the sidebar footer on
 * desktop, the topbar on mobile, both at the same time while the mobile drawer
 * is open. A per-component interval would multiply the request rate by however
 * many indicators happen to be mounted, and let two of them disagree on screen
 * because their timers drifted apart. The state lives at module scope; the hook
 * is a subscription to it.
 */
const listeners = new Set<(s: ServerHealthSnapshot) => void>();
let snapshot: ServerHealthSnapshot = { status: null, checkedAt: null };
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

function publish(next: ServerHealthSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener(snapshot);
}

async function probe(): Promise<void> {
  // A slow request plus a focus event must not stack up several in-flight
  // checks that then resolve out of order.
  if (inFlight) return;
  inFlight = true;
  try {
    const status = await checkServerHealth();
    publish({ status, checkedAt: Date.now() });
  } finally {
    inFlight = false;
  }
}

// The browser knowing it is offline is instant and free; waiting up to a full
// poll interval to show it would be needlessly slow.
const onOffline = () => publish({ status: 'offline', checkedAt: Date.now() });
const onWake = () => void probe();

function startPolling(): void {
  if (timer) return;
  timer = setInterval(() => void probe(), POLL_MS);
  window.addEventListener('focus', onWake);
  window.addEventListener('online', onWake);
  window.addEventListener('offline', onOffline);
  void probe();
}

function stopPolling(): void {
  if (listeners.size > 0 || !timer) return;
  clearInterval(timer);
  timer = null;
  window.removeEventListener('focus', onWake);
  window.removeEventListener('online', onWake);
  window.removeEventListener('offline', onOffline);
}

/** Subscribe to the shared server-health poll. */
export function useServerHealth(): ServerHealthState {
  const [state, setState] = useState<ServerHealthSnapshot>(snapshot);

  useEffect(() => {
    listeners.add(setState);
    // A component mounting after the first probe adopts the known state via
    // useState's initialiser, so it never flashes "checking" over a result the
    // app already has.
    startPolling();
    return () => {
      listeners.delete(setState);
      stopPolling();
    };
  }, []);

  return { ...state, refresh: () => void probe() };
}
