'use client';

import React, { useEffect, useState } from 'react';
import {
  getResetPreview,
  runReset,
  runResetAll,
  type ResetGroupPreview,
  type ResetPreview,
  type ResetResult,
} from '@/lib/api/platform';
import type { ApiError } from '@/lib/api/client';

const TRACE = 'PG-DASHBOARD-SET-002';

/**
 * A short, human noun for the one-line summary — not the full group label
 * ("Orders, payments and refunds" would swamp the line). Falls back to the
 * group's own key for anything added later and not yet given a short word
 * here, so a new group shows up ugly rather than not at all.
 */
const SUMMARY_NOUN: Record<string, string> = {
  support: 'support',
  sales: 'orders',
  carts: 'carts',
  inventory: 'stock',
  customers: 'customers',
  notifications: 'notifications',
  collaborators: 'collaborators',
  products: 'products',
  gallery: 'photos',
  catalogVocabulary: 'categories',
  settings: 'settings',
};

/**
 * `61 support · 27 orders · 6 products · 5 photos (+2 files) · 15 settings`
 * — only groups with something in them, so an empty shop does not read
 * "0 support · 0 orders · …". Built entirely from the preview already on
 * screen; no extra API call.
 */
function buildSummaryLine(groups: ResetGroupPreview[]): string {
  const parts = groups
    .filter((g) => g.rowCount > 0)
    .map((g) => {
      const noun = SUMMARY_NOUN[g.key] ?? g.key;
      const files =
        g.fileCount > 0
          ? ` (+${g.fileCount.toLocaleString()} file${g.fileCount === 1 ? '' : 's'})`
          : '';
      return `${g.rowCount.toLocaleString()} ${noun}${files}`;
    });
  return parts.length > 0 ? parts.join(' · ') : 'Nothing to erase';
}

/**
 * Erase shop data. Super admin only.
 * specs/2026-07-22-platform-reset, W1.1
 *
 * Two ways in, one confirmation. The primary action erases every resettable
 * table Postgres currently has except sign-in accounts — the table list
 * comes from the server asking Postgres, not from a hand-maintained list, so
 * it cannot drift out of sync with the schema the way the eleven checkboxes
 * below have twice already. Those checkboxes still exist for the rarer case
 * of erasing only part of the shop, tucked behind "Or erase only some
 * things" so they no longer read as the main way to do this.
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
  const [runningAll, setRunningAll] = useState(false);
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

  async function handleRunAll() {
    if (!preview) return;
    setRunningAll(true);
    setError(null);
    try {
      const res = await runResetAll(typed);
      setResult(res);
      setSelected(new Set());
      setTyped('');
      // Same re-read handleRun does, so the panel reflects reality either way.
      setPreview(await getResetPreview());
    } catch (e) {
      setError((e as ApiError).message ?? 'Reset failed.');
    } finally {
      setRunningAll(false);
    }
  }

  if (loading) return null;

  // Silently absent rather than showing a locked box to every admin.
  if (unavailable) return null;
  if (!preview) return null;

  // The confirm phrase is a fixed word ('DELETE') sent by the server. Guard
  // it anyway: calling .trim() on undefined once took the whole Settings
  // page down with "Cannot read properties of undefined (reading 'trim')"
  // back when this was the shop's own name. With no phrase, running is
  // blocked (you cannot match an empty phrase), and the reason is shown below.
  const confirmationPhrase = (preview.confirmationPhrase ?? '').trim();
  const hasPhrase = confirmationPhrase.length > 0;
  const phraseMatches = hasPhrase && typed.trim() === confirmationPhrase;
  const nothingToErase = preview.groups.every((g) => g.rowCount === 0 && g.fileCount === 0);
  const busy = running || runningAll;

  const canRun = selected.size > 0 && phraseMatches && !busy && !nothingToErase;
  const canRunAll = phraseMatches && !busy && !nothingToErase;

  const totalRows = preview.groups
    .filter((g) => selected.has(g.key))
    .reduce((n, g) => n + g.rowCount, 0);
  const totalFiles = preview.groups
    .filter((g) => selected.has(g.key))
    .reduce((n, g) => n + g.fileCount, 0);

  const summaryLine = buildSummaryLine(preview.groups);

  return (
    <section
      className="dash-card"
      style={{ marginTop: 32, borderColor: 'var(--mr-danger, #b42318)' }}
      data-trace-id={`${TRACE}::EL-REGION-data-reset`}
    >
      <h2 style={{ marginTop: 0 }}>Erase shop data</h2>

      {/*
        This paragraph used to promise "Sign-in accounts are never touched".
        That stopped being true: erasing customers, collaborators or support
        also removes their logins, because leaving them behind listed people on
        this very screen whose data was gone and who could still sign in.
        Administrator and super-admin accounts are the ones that survive, and
        saying exactly which is the difference between a reassuring sentence
        and a useful one.
      */}
      <p className="dash-muted">
        Removes real data and cannot be undone. Customer, partner and support
        sign-in accounts are removed along with their data — administrator and
        super-admin logins always survive, so you can still sign in afterwards.
      </p>

      {/*
        `users` is genuinely on the API's never-deleted list — no group can wipe
        that table. But a reset does remove individual customer, partner and
        support ROWS from it by role, so listing the table name alone reads as
        "your accounts are safe" and would be misleading. The qualifier below
        says which accounts actually survive.
      */}
      <p className="dash-help-text">
        Tables never emptied: {preview.neverDeleted.join(', ')} — though
        customer, partner and support accounts are removed from{' '}
        <code>users</code> by role.
      </p>

      <p
        className="dash-muted"
        data-trace-id={`${TRACE}::EL-TEXT-reset-summary`}
      >
        {summaryLine}
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
            onChange={(e) => {
              setTyped(e.target.value);
              setResult(null);
              setError(null);
            }}
            disabled={busy}
            autoComplete="off"
            data-trace-id={`${TRACE}::EL-INPUT-reset-confirm`}
          />
        </div>
      ) : (
        <p className="dash-inline-error">
          The reset confirmation phrase is unavailable right now. Erasing is
          blocked until it loads.
        </p>
      )}

      <button
        type="button"
        className="dash-btn-danger"
        onClick={handleRunAll}
        disabled={!canRunAll}
        style={{ marginTop: 12 }}
        data-trace-id={`${TRACE}::EL-BTN-run-reset-all`}
      >
        {runningAll
          ? 'Erasing everything…'
          : 'Erase everything except admin logins'}
      </button>

      <details style={{ marginTop: 20 }}>
        <summary
          className="dash-muted"
          style={{ cursor: 'pointer' }}
          data-trace-id={`${TRACE}::EL-TOGGLE-reset-partial`}
        >
          Or erase only some things
        </summary>

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
                  disabled={busy || empty}
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

            <button
              type="button"
              className="dash-btn-danger"
              onClick={handleRun}
              disabled={!canRun}
              data-trace-id={`${TRACE}::EL-BTN-run-reset`}
            >
              {running ? 'Erasing…' : 'Erase the ticked data'}
            </button>

            {/*
              The typing box is at the TOP of this panel; this button is at the
              bottom of a collapsed <details>, which on a real shop means the
              two are a screen apart. Without this line the button just sat
              there doing nothing when clicked, and the reason was scrolled out
              of sight. Owner, 2026-08-24: "erase ticked data isnt working".
            */}
            {hasPhrase && !phraseMatches && !busy && (
              <p className="dash-help-text" style={{ marginTop: 8 }}>
                Type {confirmationPhrase} in the box above to enable this.
              </p>
            )}
          </>
        )}
      </details>

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
