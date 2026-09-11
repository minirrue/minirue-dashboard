'use client';

import React, { useEffect, useState } from 'react';
import {
  getResetPreview,
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
  discounts: 'offers',
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
 * One action, one confirmation, one answer.
 *
 * This panel used to offer thirteen tick boxes for erasing part of the shop,
 * with a second button of their own below a collapsed "Or erase only some
 * things". That shape produced two owner reports in a month: "erase ticked data
 * isnt working" (2026-08-24 — it was disabled because the typing box, a screen
 * above, had not been filled in), and then, plainly, remove the tick boxes,
 * leave the one check that is actually needed, and say whether it worked.
 *
 * So: the only thing to decide here is whether to erase, the only gate is
 * typing the confirmation word, and the outcome is announced next to the button
 * that caused it rather than as a line of prose at the foot of the card. The
 * per-group endpoint still exists on the server (`POST /platform/reset` with a
 * group list) — this screen simply stops being a way to reach it.
 *
 * The server enforces all of this again — this panel is the explanation, not
 * the lock.
 */
export default function DataResetPanel() {
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);

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

  async function handleRun() {
    if (!preview) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await runResetAll(typed);
      setResult(res);
      setTyped('');
      // Re-read so the counts on screen reflect what is actually left.
      setPreview(await getResetPreview());
    } catch (e) {
      // Whatever went wrong, the admin is told. An erase that quietly does
      // nothing is the failure this panel keeps being reported for.
      setError(
        (e as ApiError).message ?? 'The erase did not run. Nothing was removed.',
      );
    } finally {
      setRunning(false);
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
  const nothingToErase = preview.groups.every(
    (g) => g.rowCount === 0 && g.fileCount === 0,
  );

  const canRun = phraseMatches && !running && !nothingToErase;
  const summaryLine = buildSummaryLine(preview.groups);

  /**
   * Why the button is dead, said next to the button. `.dash-btn-danger` has a
   * `:disabled` rule now, but "greyed out" still does not tell anyone what to
   * do about it.
   */
  const blockedReason = running
    ? null
    : nothingToErase
      ? 'There is nothing left to erase.'
      : !hasPhrase
        ? 'Blocked until the confirmation word loads.'
        : !phraseMatches
          ? `Type ${confirmationPhrase} in the box above to enable this.`
          : null;

  const removedRows = result
    ? Object.values(result.deleted).reduce((a, b) => a + b, 0)
    : 0;

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

      <p className="dash-muted" data-trace-id={`${TRACE}::EL-TEXT-reset-summary`}>
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
            disabled={running}
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

      {/*
        The answer, where the question was asked. A failure is an alert, a
        finished wipe is a status, so neither is only a colour.
      */}
      {error && (
        <p
          className="dash-inline-error"
          role="alert"
          style={{ marginTop: 12 }}
          data-trace-id={`${TRACE}::EL-TEXT-reset-failed`}
        >
          Erase failed — {error}
        </p>
      )}

      {result && (
        <p
          className="dash-inline-ok"
          role="status"
          style={{ marginTop: 12, marginBottom: 0 }}
          data-trace-id={`${TRACE}::EL-TEXT-reset-result`}
        >
          Erase complete — removed {removedRows.toLocaleString()} record
          {removedRows === 1 ? '' : 's'}
          {result.filesDeleted > 0
            ? ` and ${result.filesDeleted.toLocaleString()} file${
                result.filesDeleted === 1 ? '' : 's'
              }`
            : ''}
          . Your administrator sign-in still works.
        </p>
      )}

      <button
        type="button"
        className="dash-btn-danger"
        onClick={handleRun}
        disabled={!canRun}
        style={{ marginTop: 12 }}
        data-trace-id={`${TRACE}::EL-BTN-run-reset-all`}
      >
        {running ? 'Erasing everything…' : 'Erase everything except admin logins'}
      </button>

      {blockedReason && (
        <p className="dash-help-text" style={{ marginTop: 8 }}>
          {blockedReason}
        </p>
      )}
    </section>
  );
}
