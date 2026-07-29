'use client';

/**
 * ServerStatus — is the API up, shown as a dot.
 *
 * Green means the API answered and reported itself healthy. Red means it did
 * not: either nothing answered at all (offline) or it answered unhealthy
 * (degraded — the endpoint returns 503 when it cannot reach the database).
 * Both are red because in both cases the dashboard cannot be trusted to save
 * anything, but the label still says which, because "the server is gone" and
 * "the server is up but the database is not" are different call-outs.
 *
 * Grey means the first probe has not answered yet. It is never green until
 * something has actually been checked.
 *
 * Inline styles rather than dash-* classes so it renders identically on the
 * login page, which is outside the dashboard shell and its stylesheet.
 */

import React from 'react';
import { useServerHealth } from '@/lib/hooks/use-server-health';
import type { ServerHealth } from '@/lib/api/health';

interface ServerStatusProps {
  /**
   * `dot` is for tight spaces like the topbar: the dot alone while everything
   * is fine, but the label appears the moment it is not. A permanent "SERVER
   * ONLINE" caption is noise nobody reads, and noise nobody reads is exactly
   * what gets ignored on the day it changes. The label is always available to
   * screen readers and on hover regardless.
   *
   * `full` always shows the label — for the login page, where the question
   * "is it me or is it them?" is the whole reason someone is looking.
   */
  variant?: 'dot' | 'full';
  className?: string;
}

const PRESENTATION: Record<
  ServerHealth | 'checking',
  { color: string; label: string; hint: string }
> = {
  online: {
    color: 'var(--mr-status-online, #16A34A)',
    label: 'Server online',
    hint: 'The API answered and reported itself healthy.',
  },
  degraded: {
    color: 'var(--mr-danger, #8E1418)',
    label: 'Server degraded',
    hint: 'The API answered but is not healthy — it usually means it cannot reach the database. Saving may fail.',
  },
  offline: {
    color: 'var(--mr-danger, #8E1418)',
    label: 'Server offline',
    hint: 'The API did not answer. Nothing you do here will save until it is back.',
  },
  checking: {
    color: 'var(--mr-ink-300, #9A9A9A)',
    label: 'Checking server…',
    hint: 'Waiting for the first health check to answer.',
  },
};

function agoLabel(checkedAt: number | null): string {
  if (!checkedAt) return '';
  const seconds = Math.max(0, Math.round((Date.now() - checkedAt) / 1000));
  if (seconds < 60) return `Checked ${seconds}s ago.`;
  return `Checked ${Math.round(seconds / 60)}m ago.`;
}

export default function ServerStatus({ variant = 'full', className }: ServerStatusProps) {
  const { status, checkedAt, refresh } = useServerHealth();
  const view = PRESENTATION[status ?? 'checking'];
  const healthy = status === 'online';
  const quiet = healthy || status === null;
  const labelHidden = variant === 'dot' && quiet;

  return (
    <button
      type="button"
      onClick={refresh}
      className={className}
      // Polite, not assertive: the server going down matters, but it should not
      // interrupt someone mid-sentence in a form field.
      role="status"
      aria-live="polite"
      title={`${view.label}. ${view.hint} ${agoLabel(checkedAt)}`.trim()}
      data-server-status={status ?? 'checking'}
      data-trace-id="PG-DASHBOARD-OPS-001::EL-BTN-server-status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'none',
        border: 0,
        padding: variant === 'dot' ? 6 : '6px 4px',
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        lineHeight: 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flex: '0 0 auto',
          background: view.color,
          // A halo only when something is wrong, so a healthy dashboard stays
          // quiet and a broken one is hard to miss.
          boxShadow: quiet ? 'none' : `0 0 0 3px ${view.color}33`,
        }}
      />
      <span
        style={
          labelHidden
            ? {
                // Visually hidden, still read aloud — the dot alone means
                // nothing to a screen reader.
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
                whiteSpace: 'nowrap',
              }
            : {
                fontFamily: "'Jost', sans-serif",
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                color: healthy ? 'var(--mr-ink-500, #6B6B6B)' : view.color,
              }
        }
      >
        {view.label}
      </span>
    </button>
  );
}
