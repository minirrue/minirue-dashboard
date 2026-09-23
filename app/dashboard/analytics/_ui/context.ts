'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AnalyticsModel, PathRow, SectionId } from '@/lib/analytics/model';
import type { ViewState } from '@/lib/analytics/view-state';
import type { AnalyticsRangeState } from '@/lib/analytics/range';
import type { KnownRoutes } from '@/lib/analytics/journey';
import type { Filters } from '@/lib/analytics/visitors';
import type { AudienceSummary, ReconcileReport } from '@/lib/api/analytics-insights';

export interface ShellApi {
  model: AnalyticsModel;
  range: AnalyticsRangeState;
  routes: KnownRoutes | null;
  summary: AudienceSummary | null;
  recon: ReconcileReport | null;
  view: ViewState;
  setView: (patch: Partial<ViewState>) => void;
  /** Journeys: the visitor whose journey is open. */
  journeyId: string | null;
  setJourneyId: (id: string | null) => void;
  go: (section: SectionId, opts?: { anchor?: string; filters?: Partial<Filters>; search?: string; visitorId?: string }) => void;
  openVisitor: (id: string) => void;
  openPath: (row: PathRow) => void;
  openWhoCounts: () => void;
  toast: (msg: string) => void;
  loading: boolean;
}

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell(): ShellApi {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell outside the Analytics shell');
  return ctx;
}

/* ── Small persisted UI preferences (localStorage, always inside try/catch) ─ */

const listeners = new Set<() => void>();

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage full: the preference just isn't remembered.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** A stored string, `null` on the server and on the first client render (no hydration mismatch). */
export function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  );
}
