'use client';

import React from 'react';
import {
  createDiscount,
  isManualSitewideCode,
  killDiscount,
  listDiscounts,
  setAutomatic,
  stopAutomatic,
  type Discount,
} from '@/lib/api/discounts';
import { errorMessageToText } from '@/lib/api/client';
import {
  endOfShopDayIso,
  SHOP_TIME_ZONE,
  startOfShopDayIso,
} from '@/lib/dates/end-of-shop-day';
import { codeNameProblem, formatCodeName } from '@/lib/discounts/code-name';
import { apiOfferImpact } from '@/lib/api/accounting';

type Mode = 'AUTOMATIC' | 'MANUAL';

const IMPACT_DEBOUNCE_MS = 400;

function products(n: number): string {
  return `${n} ${n === 1 ? 'product' : 'products'}`;
}

/** "3 products will be capped at their floor · 2 dip below Law 1 (…)"; '' when nothing is hit. */
function impactText(capped: number, belowLaw1: number): string {
  const law1 = '(profit from the delivery fee)';
  const dip = belowLaw1 === 1 ? 'dips' : 'dip';
  if (capped > 0 && belowLaw1 > 0) {
    return `${products(capped)} will be capped at their floor · ${belowLaw1} ${dip} below Law 1 ${law1}`;
  }
  if (capped > 0) return `${products(capped)} will be capped at their floor`;
  if (belowLaw1 > 0) return `${products(belowLaw1)} ${dip} below Law 1 ${law1}`;
  return '';
}

/**
 * What a percent offer would do to the floors, before it is saved (epic
 * backend#155, `GET accounting/offers/impact`). Asked 400ms after typing stops.
 * Advisory only: a failed call shows nothing and never blocks saving. `percent`
 * null = not a percent offer (a fixed-amount code), so nothing is asked.
 *
 * Shared with CodesPanel.
 */
export function OfferImpactLine({ percent }: { percent: string | null }) {
  const n = percent === null ? NaN : Number(percent);
  const percentBp = Number.isFinite(n) ? Math.round(n * 100) : NaN;
  const valid = percentBp >= 1 && percentBp <= 10000;
  // Keyed by the percent it answers, so a stale answer is never shown for a new value.
  const [result, setResult] = React.useState<{ percentBp: number; text: string } | null>(null);

  React.useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      apiOfferImpact({ percentBp }).then(
        (r) => {
          if (!cancelled) {
            setResult({ percentBp, text: impactText(r.cappedProductCount, r.belowLaw1ProductCount) });
          }
        },
        () => {
          if (!cancelled) setResult(null);
        },
      );
    }, IMPACT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [percentBp, valid]);

  const text = valid && result?.percentBp === percentBp ? result.text : '';
  return (
    <div role="status" aria-live="polite">
      {text && (
        <p
          style={{
            margin: '16px 0 0',
            padding: '8px 12px',
            fontSize: 13,
            lineHeight: 1.45,
            color: 'var(--mr-st-warn-fg)',
            background: 'var(--mr-st-warn-bg)',
            borderRadius: 'var(--mr-radius-sm)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {text}
        </p>
      )}
    </div>
  );
}

function shopDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, { timeZone: SHOP_TIME_ZONE })
    : '—';
}

/**
 * A sitewide offer — a percentage off everything MiniRue makes — in one of two
 * modes (backend#103):
 *
 * - **Automatic**: applies to every eligible bag with no action; product cards
 *   strike the old price through. Only one can run at a time — starting a new
 *   one retires the running one in the same breath, because two live markdowns
 *   is an unanswerable question about which one an order got.
 * - **Manual code**: applies only once the shopper types the code the admin
 *   named at checkout. Prices stay full everywhere else — the storefront's
 *   `/discounts/sitewide` reports automatic offers only, so no card ever
 *   advertises it. Several can run (one per campaign); each carries its own
 *   dates and usage limits, all enforced by the server at Place order.
 *
 * The two never stack: a bag gets whichever saves more.
 */
export default function SitewidePanel({
  onChanged,
  refreshToken,
}: {
  onChanged: () => void;
  refreshToken: number;
}) {
  const [mode, setMode] = React.useState<Mode>('AUTOMATIC');
  const [live, setLive] = React.useState<Discount | null>(null);
  const [manualLive, setManualLive] = React.useState<Discount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [stoppingAuto, setStoppingAuto] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [justCreated, setJustCreated] = React.useState<string | null>(null);

  // Shared by both modes.
  const [percent, setPercent] = React.useState('10');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [note, setNote] = React.useState('');
  // Manual only.
  const [code, setCode] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [maxRedemptions, setMaxRedemptions] = React.useState('');
  const [maxPerCustomer, setMaxPerCustomer] = React.useState('1');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listDiscounts(false);
      setLive(
        all.find((d) => d.kind === 'AUTOMATIC' && d.isActive && !d.killedAt) ??
          null,
      );
      setManualLive(
        all.filter((d) => isManualSitewideCode(d) && d.isActive && !d.killedAt),
      );
    } catch (e) {
      setError(errorMessageToText(e, 'Could not load the sitewide discount'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load, refreshToken]);

  async function startAutomatic(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setAutomatic({
        percent: Number(percent),
        // End of the chosen day in Cairo, not UTC midnight — which switched the
        // offer off in the small hours of the day it was meant to run through,
        // and made an offer ending today already expired (frontend#83).
        expiresAt: expiresAt ? endOfShopDayIso(expiresAt) : null,
        note: note.trim() || null,
      });
      setNote('');
      onChanged();
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not start the sitewide discount'));
    } finally {
      setSaving(false);
    }
  }

  async function stop() {
    // No confirm dialog, same as stopManual below and Codes → Stop: the owner
    // asked for Stop to stop directly (2026-08-21, dashboard#47). Placed orders
    // keep their discount, and an offer can be started again from the form.
    setError(null);
    setStoppingAuto(true);
    try {
      await stopAutomatic();
      onChanged();
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not stop the sitewide discount'));
    } finally {
      setStoppingAuto(false);
    }
  }

  const codeProblem = code.trim() ? codeNameProblem(code) : null;
  const datesProblem =
    startsAt && expiresAt && expiresAt < startsAt
      ? 'It ends before it starts — pick an end date on or after the start.'
      : null;
  const canCreate = !!code.trim() && !codeProblem && !datesProblem && !saving;

  async function createManual(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    setJustCreated(null);
    try {
      const created = await createDiscount({
        kind: 'GLOBAL',
        valueType: 'PERCENT',
        percent: Number(percent),
        // What the admin saw in the preview. The server normalises it again
        // and is the one that decides whether it is taken.
        code: formatCodeName(code),
        // No product, no owner: that is what makes it apply to the whole bag.
        productId: null,
        ownerCustomerId: null,
        // Start of the first day and end of the last, both in Cairo.
        startsAt: startsAt ? startOfShopDayIso(startsAt) : null,
        expiresAt: expiresAt ? endOfShopDayIso(expiresAt) : null,
        maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
        maxPerCustomer: Number(maxPerCustomer) || 1,
        note: note.trim() || null,
      });
      setJustCreated(created.code);
      setCode('');
      setNote('');
      onChanged();
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not create the code'));
    } finally {
      setSaving(false);
    }
  }

  async function stopManual(d: Discount) {
    // No confirm dialog: the owner asked for Stop to stop directly
    // (2026-08-21), and it is never retroactive — placed orders keep theirs.
    setError(null);
    try {
      await killDiscount(d.id);
      onChanged();
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not stop the code'));
    }
  }

  const preview = formatCodeName(code);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error && <p className="dash-error">{error}</p>}

      <section className="dash-card">
        <h2 className="dash-card-title" id="sitewide-mode-label">How it applies</h2>
        <div
          role="radiogroup"
          aria-labelledby="sitewide-mode-label"
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        >
          {(
            [
              { id: 'AUTOMATIC' as const, label: 'Automatic' },
              { id: 'MANUAL' as const, label: 'Manual code' },
            ]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              className={mode === m.id ? 'dash-btn-primary' : 'dash-btn-secondary'}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="dash-help-text">
          {mode === 'AUTOMATIC'
            ? 'Applies to every bag by itself. Shoppers see the old price struck through on every product.'
            : 'Applies only when a shopper types the code at checkout. Prices stay full everywhere until they do.'}
        </p>
      </section>

      {mode === 'AUTOMATIC' ? (
        <>
          <section className="dash-card">
            <h2 className="dash-card-title">Running now</h2>
            {loading ? (
              <p className="dash-muted">Loading…</p>
            ) : live ? (
              <>
                <p>
                  <strong>{live.percent}% off</strong> everything MiniRue makes.
                  {live.expiresAt
                    ? ` Ends ${shopDate(live.expiresAt)}.`
                    : ' No end date.'}
                  {live.note ? ` — ${live.note}` : ''}
                </p>
                <div className="dash-form-actions">
                  <button
                    type="button"
                    className="dash-btn-danger"
                    disabled={stoppingAuto}
                    onClick={() => void stop()}
                  >
                    {stoppingAuto ? 'Stopping…' : 'Stop it'}
                  </button>
                </div>
              </>
            ) : (
              <p className="dash-panel-empty">Nothing running. Prices are normal.</p>
            )}
          </section>

          <section className="dash-card">
            <h2 className="dash-card-title">
              {live ? 'Replace it' : 'Start a sitewide discount'}
            </h2>
            <form onSubmit={startAutomatic}>
              <div className="dash-form-grid">
                <div className="dash-field">
                  <label className="dash-label" htmlFor="auto-percent">Percent off</label>
                  {/* See CodesPanel: step counts from min, so 0.5 put whole numbers
                      off the grid and a plain 10 was refused. */}
                  <input
                    id="auto-percent"
                    className="dash-input"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    required
                  />
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor="auto-expires">Ends</label>
                  <input
                    id="auto-expires"
                    className="dash-input"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor="auto-note">Note to yourself</label>
                  <input
                    id="auto-note"
                    className="dash-input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Eid week"
                  />
                </div>
              </div>

              <OfferImpactLine percent={percent} />

              <div className="dash-form-actions">
                <button type="submit" className="dash-btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : live ? 'Replace' : 'Start'}
                </button>
              </div>

              <p className="dash-help-text">
                This never adds to a typed code — whoever&rsquo;s bag it is gets
                whichever of the two saves them more, never both. It applies to
                MiniRue&rsquo;s own products only, so any wording you use elsewhere
                should say MiniRue rather than &ldquo;everything&rdquo;.
              </p>
            </form>
          </section>
        </>
      ) : (
        <>
          {justCreated && (
            <p className="dash-inline-ok">
              Created <strong>{justCreated}</strong> — this is exactly what shoppers type.{' '}
              <button
                type="button"
                className="dash-btn-secondary"
                onClick={() => void navigator.clipboard?.writeText(justCreated)}
              >
                Copy
              </button>
            </p>
          )}

          <section className="dash-card">
            <h2 className="dash-card-title" id="manual-running-label">Manual codes running now</h2>
            {loading ? (
              <p className="dash-muted">Loading…</p>
            ) : manualLive.length === 0 ? (
              <p className="dash-panel-empty">No manual sitewide codes running.</p>
            ) : (
              <div className="dash-table-wrap">
                <table className="dash-table" aria-label="Manual sitewide codes running now">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Takes off</th>
                      <th>Starts</th>
                      <th>Ends</th>
                      <th>Used</th>
                      <th>Per customer</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {manualLive.map((d) => (
                      <tr key={d.id}>
                        <td>
                          {/* nowrap: a spaced name must read as ONE code,
                              not break into two words in a narrow table. */}
                          <code className="dash-slug" style={{ whiteSpace: 'nowrap' }}>{d.code}</code>
                        </td>
                        <td>{d.percent}% off</td>
                        <td>{shopDate(d.startsAt)}</td>
                        <td>{shopDate(d.expiresAt)}</td>
                        <td>
                          {d.usedCount} / {d.maxRedemptions === null ? '∞' : d.maxRedemptions}
                        </td>
                        <td>{d.maxPerCustomer}</td>
                        <td>
                          <button
                            type="button"
                            className="dash-btn-secondary"
                            aria-label={`Stop ${d.code}`}
                            onClick={() => void stopManual(d)}
                          >
                            Stop
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dash-card">
            <h2 className="dash-card-title">New manual code</h2>
            <form onSubmit={createManual} noValidate>
              <div className="dash-form-grid">
                <div className="dash-field">
                  <label className="dash-label" htmlFor="manual-code">
                    Code <span className="dash-required">*</span>
                  </label>
                  <input
                    id="manual-code"
                    className="dash-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="SUMMER SALE"
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby="manual-code-preview"
                    aria-invalid={!!codeProblem}
                    required
                  />
                  {codeProblem ? (
                    <p id="manual-code-preview" className="dash-field-error" role="alert">
                      {codeProblem}
                    </p>
                  ) : (
                    <p id="manual-code-preview" className="dash-help-text" style={{ marginTop: 4 }}>
                      {preview ? (
                        <>
                          Saved as{' '}
                          <strong data-testid="code-name-preview" style={{ letterSpacing: '0.04em' }}>
                            {preview}
                          </strong>
                          {' '}— shoppers can type it in any case, with or without the spaces.
                        </>
                      ) : (
                        'Letters, digits and spaces. Saved in capitals.'
                      )}
                    </p>
                  )}
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor="manual-percent">Percent off</label>
                  <input
                    id="manual-percent"
                    className="dash-input"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    required
                  />
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor="manual-starts">Starts</label>
                  <input
                    id="manual-starts"
                    className="dash-input"
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor="manual-expires">Ends</label>
                  <input
                    id="manual-expires"
                    className="dash-input"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    aria-invalid={!!datesProblem}
                  />
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor="manual-max">Total uses</label>
                  <input
                    id="manual-max"
                    className="dash-input"
                    type="number"
                    min="1"
                    value={maxRedemptions}
                    onChange={(e) => setMaxRedemptions(e.target.value)}
                    placeholder="blank = unlimited"
                  />
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor="manual-per">Uses per customer</label>
                  <input
                    id="manual-per"
                    className="dash-input"
                    type="number"
                    min="1"
                    value={maxPerCustomer}
                    onChange={(e) => setMaxPerCustomer(e.target.value)}
                  />
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor="manual-note">Note to yourself</label>
                  <input
                    id="manual-note"
                    className="dash-input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Summer campaign"
                  />
                </div>
              </div>

              <OfferImpactLine percent={percent} />

              {datesProblem && <p className="dash-error" role="alert">{datesProblem}</p>}

              <div className="dash-form-actions">
                <button type="submit" className="dash-btn-primary" disabled={!canCreate}>
                  {saving ? 'Creating…' : 'Create code'}
                </button>
              </div>

              <p className="dash-help-text">
                The shop checks the dates and both limits again when the order is
                placed, and a shopper who types a wrong, expired or used-up code
                only ever sees &ldquo;This code isn&rsquo;t valid.&rdquo; Repeated
                wrong guesses are blocked for 30 minutes. Like the automatic
                offer, it never adds to another discount, and applies to
                MiniRue&rsquo;s own products only.
              </p>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
