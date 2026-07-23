'use client';

import React, { useEffect, useState } from 'react';
import {
  getResetPreview,
  runReset,
  type ResetPreview,
  type ResetResult,
} from '@/lib/api/platform';
import type { ApiError } from '@/lib/api/client';

const TRACE = 'PG-DASHBOARD-SET-002';

/**
 * Erase shop data. Super admin only.
 * specs/2026-07-22-platform-reset
 *
 * Nothing is assumed on the admin's behalf. The server is asked what exists,
 * every part is shown with its real count, and each one has to be ticked. Then
 * the shop's name has to be typed. Only then does the button do anything.
 *
 * The server enforces all of this again — this panel is the explanation, not
 * the lock.
 */
export default function DataResetPanel() {
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    getResetPreview()
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((e: ApiError) => {
        if (cancelled) return;
        // 403 here is the normal case for anyone who is not a super admin, or
        // for an environment where the reset is switched off. Neither is an
        // error worth shouting about.
        setUnavailable(
          e.status === 403
            ? e.message ?? 'Not available for this account.'
            : e.message ?? 'Could not load the reset options.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(key: string) {
    setResult(null);
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      next.add(key);
      // Ticking something that cannot stand alone ticks what it needs too,
      // rather than letting the admin discover the rule from an error.
      const group = preview?.groups.find((g) => g.key === key);
      for (const required of group?.requires ?? []) next.add(required);
      return next;
    });
  }

  async function handleRun() {
    if (!preview) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runReset([...selected], typed);
      setResult(res);
      setSelected(new Set());
      setTyped('');
      // Re-read so the counts on screen reflect what is actually left.
      setPreview(await getResetPreview());
    } catch (e) {
      setError((e as ApiError).message ?? 'Reset failed.');
    } finally {
      setRunning(false);
    }
  }

  if (loading) return null;

  // Silently absent rather than showing a locked box to every admin.
  if (unavailable) return null;
  if (!preview) return null;

  // The confirm phrase is the shop's name, which a brand-new shop may not have
  // set yet — the API then sends it back empty or missing. Guard it: calling
  // .trim() on undefined took the whole Settings page down with "Cannot read
  // properties of undefined (reading 'trim')". With no phrase, running is
  // blocked (you cannot match an empty phrase), and the reason is shown below.
  const confirmationPhrase = (preview.confirmationPhrase ?? '').trim();
  const hasPhrase = confirmationPhrase.length > 0;
  const phraseMatches = hasPhrase && typed.trim() === confirmationPhrase;
  const canRun = selected.size > 0 && phraseMatches && !running;
  const totalRows = preview.groups
    .filter((g) => selected.has(g.key))
    .reduce((n, g) => n + g.rowCount, 0);
  const totalFiles = preview.groups
    .filter((g) => selected.has(g.key))
    .reduce((n, g) => n + g.fileCount, 0);

  return (
    <section
      className="dash-card"
      style={{ marginTop: 32, borderColor: 'var(--mr-danger, #b42318)' }}
      data-trace-id={`${TRACE}::EL-REGION-data-reset`}
    >
      <h2 style={{ marginTop: 0 }}>Erase shop data</h2>

      <p className="dash-muted">
        Ticks below remove real data and cannot be undone. Sign-in accounts are
        never touched — everyone can still log in afterwards.
      </p>

      <p className="dash-help-text">
        Always kept: {preview.neverDeleted.join(', ')}
      </p>

      <div style={{ margin: '16px 0' }}>
        {preview.groups.map((g) => {
          const isOn = selected.has(g.key);
          const empty = g.rowCount === 0 && g.fileCount === 0;
          return (
            <label
              key={g.key}
              className="dash-checkbox-label"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 0',
                opacity: empty ? 0.6 : 1,
              }}
              data-trace-id={`${TRACE}::EL-CHECK-reset-group@${g.key}`}
            >
              <input
                type="checkbox"
                className="dash-checkbox"
                checked={isOn}
                onChange={() => toggle(g.key)}
                disabled={running || empty}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>{g.label}</strong>{' '}
                <span className="dash-muted">
                  {empty
                    ? '— nothing to remove'
                    : `— ${g.rowCount.toLocaleString()} record${g.rowCount === 1 ? '' : 's'}${
                        g.fileCount > 0
                          ? ` and ${g.fileCount.toLocaleString()} file${g.fileCount === 1 ? '' : 's'}`
                          : ''
                      }`}
                </span>
                <br />
                <span className="dash-help-text">{g.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      {selected.size > 0 && (
        <>
          <p>
            <strong>
              This will remove {totalRows.toLocaleString()} record
              {totalRows === 1 ? '' : 's'}
              {totalFiles > 0
                ? ` and ${totalFiles.toLocaleString()} file${totalFiles === 1 ? '' : 's'}`
                : ''}
              .
            </strong>
          </p>

          {hasPhrase ? (
            <div className="dash-field" style={{ maxWidth: 380 }}>
              <label className="dash-label" htmlFor="reset-confirm">
                Type <strong>{confirmationPhrase}</strong> to confirm
              </label>
              <input
                id="reset-confirm"
                className="dash-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={running}
                autoComplete="off"
                data-trace-id={`${TRACE}::EL-INPUT-reset-confirm`}
              />
            </div>
          ) : (
            <p className="dash-inline-error">
              Set your shop name in Settings first — it is the phrase you type to
              confirm this. Without it, erasing is blocked.
            </p>
          )}

          <button
            type="button"
            className="dash-btn-danger"
            onClick={handleRun}
            disabled={!canRun}
            data-trace-id={`${TRACE}::EL-BTN-run-reset`}
          >
            {running ? 'Erasing…' : 'Erase the ticked data'}
          </button>
        </>
      )}

      {error && <p className="dash-inline-error">{error}</p>}

      {result && (
        <p data-trace-id={`${TRACE}::EL-TEXT-reset-result`}>
          Done. Removed{' '}
          {Object.values(result.deleted)
            .reduce((a, b) => a + b, 0)
            .toLocaleString()}{' '}
          records
          {result.filesDeleted > 0
            ? ` and ${result.filesDeleted.toLocaleString()} files`
            : ''}
          . Sign-in accounts were not touched.
        </p>
      )}
    </section>
  );
}
