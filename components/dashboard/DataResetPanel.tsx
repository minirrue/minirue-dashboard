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
import './data-reset-panel.css';

const TRACE = 'PG-DASHBOARD-SET-002';

type Mode = 'all' | 'choose';

/**
 * A short, human noun for the one-line summary — not the full group label
 * ("Orders, payments and refunds" would swamp the line). Falls back to the
 * group's own key for anything added later and not yet given a short word
 * here, so a new group shows up ugly rather than not at all.
 */
const SUMMARY_NOUN: Record<string, string> = {
  analytics: 'analytics',
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
 * Account removals the server performs that the group's own description does
 * not already say. Customers and collaborators describe their sign-in removal
 * themselves (platform-reset.constants.ts); support conversations remove STAFF
 * logins silently, so it is said here, next to the row.
 */
const ACCOUNT_NOTE: Record<string, string> = {
  support: 'Also removes support-staff sign-in accounts.',
};

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

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
      const files = g.fileCount > 0 ? ` (+${plural(g.fileCount, 'file')})` : '';
      return `${g.rowCount.toLocaleString()} ${noun}${files}`;
    });
  return parts.length > 0 ? parts.join(' · ') : 'Nothing to erase';
}

/**
 * Every group the server will erase along with `key`, transitively, in the
 * order it discovers them. Mirrors PlatformResetService.reset(), which pulls
 * these in rather than refusing — so the screen shows them ticked instead of
 * letting the counts on screen understate what goes.
 */
function cascadeOf(key: string, groups: ResetGroupPreview[]): string[] {
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const seen = new Set<string>([key]);
  const out: string[] = [];
  const queue = [key];
  while (queue.length > 0) {
    const next = queue.shift() as string;
    for (const req of byKey.get(next)?.requires ?? []) {
      if (seen.has(req)) continue;
      seen.add(req);
      out.push(req);
      queue.push(req);
    }
  }
  return out;
}

function isEmpty(g: ResetGroupPreview): boolean {
  return g.rowCount === 0 && g.fileCount === 0;
}

/**
 * Erase shop data. Super admin only.
 * specs/2026-07-22-platform-reset, W1.1 · minirue-dashboard#71
 *
 * Two modes, stacked, both visible: erase everything (`POST /reset/all`), or
 * choose groups (`POST /reset` with a group list). Then one gate — typing the
 * server's confirmation word — with the erase button directly under it and,
 * whenever that button is dead, the reason directly under the button.
 *
 * History: #23 (88ae50f) removed the per-group picker after "erase ticked data
 * isnt working" (2026-08-24). The fault was layout — the button sat disabled at
 * the bottom of a collapsed <details>, a screen away from the box it waited
 * on. The owner uses selective erase ("I don't want to delete all but rather
 * select some records only", 2026-09-15), so #71 brings it back with the gate
 * and the reason beside the button instead of removing the feature.
 *
 * The server enforces all of this again — this panel is the explanation, not
 * the lock.
 */
export default function DataResetPanel() {
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);
  /** Labels of the groups the last selective erase removed; null after "everything". */
  const [erasedLabels, setErasedLabels] = useState<string[] | null>(null);

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

  function clearOutcome() {
    setResult(null);
    setError(null);
  }

  function toggle(key: string) {
    clearOutcome();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) return null;

  // Silently absent rather than showing a locked box to every admin.
  if (unavailable) return null;
  if (!preview) return null;

  const groups = preview.groups;

  // The confirm phrase is a fixed word ('DELETE') sent by the server. Guard
  // it anyway: calling .trim() on undefined once took the whole Settings
  // page down with "Cannot read properties of undefined (reading 'trim')"
  // back when this was the shop's own name. With no phrase, running is
  // blocked (you cannot match an empty phrase), and the reason is shown below.
  const confirmationPhrase = (preview.confirmationPhrase ?? '').trim();
  const hasPhrase = confirmationPhrase.length > 0;
  const phraseMatches = hasPhrase && typed.trim() === confirmationPhrase;
  const nothingToErase = groups.every(isEmpty);

  // What the admin ticked, plus what the server would pull in with it.
  const includedBy = new Map<string, string[]>();
  for (const key of selected) {
    for (const dep of cascadeOf(key, groups)) {
      if (selected.has(dep)) continue;
      includedBy.set(dep, [...(includedBy.get(dep) ?? []), key]);
    }
  }
  const effective = groups.filter(
    (g) => selected.has(g.key) || includedBy.has(g.key),
  );
  const labelOf = (key: string) =>
    groups.find((g) => g.key === key)?.label ?? key;

  const selRows = effective.reduce((n, g) => n + g.rowCount, 0);
  const selFiles = effective.reduce((n, g) => n + g.fileCount, 0);

  const choosing = mode === 'choose';
  const nothingSelected = effective.length === 0;
  const canRun =
    phraseMatches && !running && !nothingToErase && !(choosing && nothingSelected);

  /**
   * Why the button is dead, said next to the button. Greyed out does not tell
   * anyone what to do about it.
   */
  const blockedReason = running
    ? null
    : nothingToErase
      ? 'There is nothing left to erase.'
      : choosing && nothingSelected
        ? 'Tick at least one group above.'
        : !hasPhrase
          ? 'Blocked until the confirmation word loads.'
          : !phraseMatches
            ? `Type ${confirmationPhrase} in the box above to enable this.`
            : null;

  async function handleRun() {
    if (!preview) return;
    setRunning(true);
    clearOutcome();
    try {
      let labels: string[] | null = null;
      let res: ResetResult;
      if (choosing) {
        labels = effective.map((g) => g.label);
        res = await runReset(
          effective.map((g) => g.key),
          typed,
        );
      } else {
        res = await runResetAll(typed);
      }
      setResult(res);
      setErasedLabels(labels);
      setTyped('');
      setSelected(new Set());
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

  const removedRows = result
    ? Object.values(result.deleted).reduce((a, b) => a + b, 0)
    : 0;

  const eraseLabel = running
    ? choosing
      ? 'Erasing the ticked groups…'
      : 'Erasing everything…'
    : choosing
      ? 'Erase the ticked groups'
      : 'Erase everything except admin logins';

  return (
    <section
      className="dash-card dash-reset"
      data-trace-id={`${TRACE}::EL-REGION-data-reset`}
    >
      <h2 className="dash-reset-title">Erase shop data</h2>

      {/*
        Customer, partner and support logins go with their data (8edfe1f);
        administrator and super-admin accounts are the ones that survive.
      */}
      <p className="dash-muted dash-reset-lede">
        Removes real data and cannot be undone. Customer, partner and support
        sign-in accounts are removed along with their data — administrator and
        super-admin logins always survive, so you can still sign in afterwards.
      </p>

      <p className="dash-help-text">
        Tables never emptied: {preview.neverDeleted.join(', ')} — though
        customer, partner and support accounts are removed from{' '}
        <code>users</code> by role.
      </p>

      <fieldset className="dash-reset-modes" disabled={running}>
        <legend className="dash-label">What to erase</legend>

        <div className={`dash-reset-mode${mode === 'all' ? ' is-on' : ''}`}>
          <label className="dash-reset-mode-head">
            <input
              type="radio"
              name="reset-mode"
              value="all"
              checked={mode === 'all'}
              onChange={() => {
                setMode('all');
                clearOutcome();
              }}
              aria-describedby="reset-mode-all-desc"
              data-trace-id={`${TRACE}::EL-RADIO-reset-mode@all`}
            />
            <span>Erase everything (except admin logins)</span>
          </label>
          <p
            id="reset-mode-all-desc"
            className="dash-help-text dash-reset-mode-desc"
            data-trace-id={`${TRACE}::EL-TEXT-reset-summary`}
          >
            {buildSummaryLine(groups)}
          </p>
        </div>

        <div className={`dash-reset-mode${choosing ? ' is-on' : ''}`}>
          <label className="dash-reset-mode-head">
            <input
              type="radio"
              name="reset-mode"
              value="choose"
              checked={choosing}
              onChange={() => {
                setMode('choose');
                clearOutcome();
              }}
              aria-describedby="reset-mode-choose-desc"
              data-trace-id={`${TRACE}::EL-RADIO-reset-mode@choose`}
            />
            <span>Choose what to erase</span>
          </label>
          <p id="reset-mode-choose-desc" className="dash-help-text dash-reset-mode-desc">
            Tick only the kinds of records you want gone. Everything else stays.
          </p>

          {choosing && (
            <div className="dash-reset-picker">
              <div className="dash-reset-picker-bar">
                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={() => {
                    clearOutcome();
                    setSelected(new Set(groups.filter((g) => !isEmpty(g)).map((g) => g.key)));
                  }}
                  disabled={nothingToErase}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={() => {
                    clearOutcome();
                    setSelected(new Set());
                  }}
                  disabled={nothingSelected}
                >
                  Clear
                </button>
              </div>

              <ul className="dash-reset-groups">
                {groups.map((g) => {
                  const implied = includedBy.get(g.key);
                  const isOn = selected.has(g.key) || !!implied;
                  const empty = isEmpty(g);
                  const cascade = cascadeOf(g.key, groups);
                  const descId = `reset-group-desc-${g.key}`;
                  return (
                    <li
                      key={g.key}
                      className={`dash-reset-group${isOn ? ' is-on' : ''}${empty ? ' is-empty' : ''}`}
                      data-testid={`reset-group-${g.key}`}
                      data-trace-id={`${TRACE}::EL-CHECK-reset-group@${g.key}`}
                    >
                      <label className="dash-reset-group-head">
                        <input
                          type="checkbox"
                          className="dash-checkbox"
                          checked={isOn}
                          onChange={() => toggle(g.key)}
                          disabled={!!implied || (empty && !isOn)}
                          aria-describedby={descId}
                        />
                        <span className="dash-reset-group-name">{g.label}</span>
                        <span className="dash-reset-group-count">
                          {empty
                            ? 'nothing to remove'
                            : `${plural(g.rowCount, 'record')}${
                                g.fileCount > 0 ? ` · ${plural(g.fileCount, 'file')}` : ''
                              }`}
                        </span>
                      </label>
                      <div id={descId} className="dash-reset-group-body">
                        <p className="dash-help-text">{g.description}</p>
                        {ACCOUNT_NOTE[g.key] && (
                          <p className="dash-reset-note">{ACCOUNT_NOTE[g.key]}</p>
                        )}
                        {cascade.length > 0 && (
                          <p className="dash-reset-note">
                            Also erases: {cascade.map(labelOf).join(', ')}
                          </p>
                        )}
                        {implied && (
                          <p className="dash-reset-note is-strong">
                            Included by {implied.map(labelOf).join(', ')} — it cannot
                            be erased without this.
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </fieldset>

      <div className="dash-reset-gate">
        {choosing && !nothingSelected && (
          <p
            className="dash-reset-selection"
            aria-live="polite"
            data-testid="reset-selection-summary"
          >
            You&apos;re about to erase {plural(effective.length, 'group')} ·{' '}
            {plural(selRows, 'record')}
            {selFiles > 0 ? ` · ${plural(selFiles, 'file')}` : ''}
          </p>
        )}

        {hasPhrase ? (
          <div className="dash-field dash-reset-confirm">
            <label className="dash-label" htmlFor="reset-confirm">
              Type <strong>{confirmationPhrase}</strong> to confirm
            </label>
            <input
              id="reset-confirm"
              className="dash-input"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                clearOutcome();
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
          finished erase is a status, so neither is only a colour.
        */}
        {error && (
          <p
            className="dash-inline-error"
            role="alert"
            data-trace-id={`${TRACE}::EL-TEXT-reset-failed`}
          >
            Erase failed — {error}
          </p>
        )}

        {result && (
          <p
            className="dash-inline-ok dash-reset-ok"
            role="status"
            data-trace-id={`${TRACE}::EL-TEXT-reset-result`}
          >
            Erase complete — removed{' '}
            {erasedLabels ? `${erasedLabels.join(', ')}: ` : ''}
            {plural(removedRows, 'record')}
            {result.filesDeleted > 0 ? ` and ${plural(result.filesDeleted, 'file')}` : ''}
            . Your administrator sign-in still works.
          </p>
        )}

        <div>
          <button
            type="button"
            className="dash-btn-danger"
            onClick={handleRun}
            disabled={!canRun}
            aria-describedby={blockedReason ? 'reset-blocked-reason' : undefined}
            data-trace-id={`${TRACE}::EL-BTN-run-reset${choosing ? '' : '-all'}`}
          >
            {eraseLabel}
          </button>

          {blockedReason && (
            <p id="reset-blocked-reason" className="dash-help-text dash-reset-reason">
              {blockedReason}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
