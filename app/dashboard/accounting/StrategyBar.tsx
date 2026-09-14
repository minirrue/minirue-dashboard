'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  apiAccountingOverview,
  apiUndoPricingRun,
  apiUpdatePricingSettings,
  type AccountingOverview,
  type PricingSettingsPatch,
  type RunSummary,
} from '@/lib/api/accounting';
import './strategy-bar.css';

const DAY_MS = 86_400_000;
const RATE_RE = /^\d+(\.\d{1,4})?$/;

type Status =
  | { kind: 'run'; run: RunSummary; undoable: boolean; prefix?: string }
  | { kind: 'undone'; run: RunSummary }
  | { kind: 'error'; text: string }
  | { kind: 'note'; text: string };

function errorMessage(e: unknown): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m.trim() !== '' ? m.replace(/\.$/, '') : 'the server did not accept it';
}

/** −310 bp → "−3.1%", 420 → "+4.2%". */
export function formatAverage(bp: number): string {
  const pct = Math.round(Math.abs(bp) / 10) / 10;
  if (pct === 0) return '0%';
  return `${bp < 0 ? '−' : '+'}${pct.toFixed(1)}%`;
}

export function describeRun(run: RunSummary): string {
  const n = run.changedCount;
  if (n === 0) return 'No prices changed';
  const count = `${n} ${n === 1 ? 'price' : 'prices'} changed`;
  return run.averageChangeBp === null ? count : `${count} · average ${formatAverage(run.averageChangeBp)}`;
}

export function setAgo(iso: string, now: number): string {
  const days = Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS));
  if (days === 0) return 'set today';
  return `set ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

const toPosition = (bp: number) => Math.round(bp / 100);

/**
 * Reach ⟷ Profit slider, the dollar rate and the result line with Undo
 * (minirue-dashboard#58, epic backend#155 Rules 3 and 5). Both controls
 * reprice every System price live on the server: the slider on release
 * (pointer-up or key-up, never while dragging), the rate on Enter or blur.
 */
export default function StrategyBar({ onRepriced }: { onRepriced?: () => void }) {
  const [overview, setOverview] = useState<AccountingOverview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(0);
  const [position, setPosition] = useState(0);
  const [rateInput, setRateInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  /** Synchronous guard: pointer-up, key-up and blur can all fire for one release. */
  const inFlight = useRef(false);
  /** Disabling a focused control drops focus; hand it back when the request ends. */
  const refocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (busy || !refocus.current) return;
    refocus.current.focus();
    refocus.current = null;
  }, [busy]);

  const adopt = useCallback((o: AccountingOverview) => {
    setOverview(o);
    /** "set N days ago" is measured when the data arrives, keeping render pure. */
    setNow(Date.now());
    setPosition(toPosition(o.pricing.strategyBp));
    setRateInput(o.pricing.usdRate?.egpPerUsd ?? '');
  }, []);

  const load = useCallback(() => {
    let cancelled = false;
    apiAccountingOverview()
      .then((o) => {
        if (cancelled) return;
        adopt(o);
        const last = o.lastRun;
        if (last && !last.undoneAt && o.undoableRunId === last.id && last.cause !== 'UNDO') {
          setStatus({ kind: 'run', run: last, undoable: true, prefix: 'Last change' });
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [adopt]);

  useEffect(() => load(), [load]);

  const save = async (patch: PricingSettingsPatch) => {
    if (!overview || inFlight.current) return;
    inFlight.current = true;
    const active = document.activeElement;
    refocus.current = active instanceof HTMLInputElement && active.closest('.acct-sb') ? active : null;
    setBusy(true);
    setStatus(null);
    try {
      const res = await apiUpdatePricingSettings(patch);
      adopt(res.overview);
      setStatus({ kind: 'run', run: res.run, undoable: res.overview.undoableRunId === res.run.id });
      onRepriced?.();
    } catch (e) {
      adopt(overview);
      setStatus({ kind: 'error', text: `Could not reprice: ${errorMessage(e)}. Nothing changed.` });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const commitPosition = (raw: string) => {
    if (!overview || inFlight.current) return;
    const bp = Number(raw) * 100;
    if (!Number.isFinite(bp) || bp === overview.pricing.strategyBp) return;
    void save({ strategyBp: bp });
  };

  const commitRate = () => {
    if (!overview || inFlight.current) return;
    const value = rateInput.trim();
    if (value === (overview.pricing.usdRate?.egpPerUsd ?? '')) return;
    if (!RATE_RE.test(value) || Number(value) <= 0) {
      setStatus({ kind: 'error', text: 'Enter the rate as a number above 0, like 50.85. Nothing was saved.' });
      return;
    }
    // The server stamps setAt itself; the schema still wants a timestamp.
    void save({ usdRate: { egpPerUsd: value, setAt: new Date(Date.now()).toISOString() } });
  };

  const undo = async (runId: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await apiUndoPricingRun(runId);
      adopt(res.overview);
      setStatus({ kind: 'undone', run: res.run });
      onRepriced?.();
    } catch (e) {
      if ((e as { status?: number } | null)?.status === 409) {
        setStatus({ kind: 'note', text: 'Prices were edited since — Undo unavailable' });
      } else {
        setStatus({ kind: 'error', text: `Could not undo: ${errorMessage(e)}. Nothing changed.` });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <section className="dash-card acct-sb acct-sb-state" aria-label="Pricing strategy">
        <p role="alert">Could not load the pricing strategy. Check your connection and try again.</p>
        <button
          type="button"
          className="dash-btn-secondary"
          onClick={() => {
            setLoadError(false);
            load();
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="dash-card acct-sb" aria-label="Pricing strategy" aria-busy="true">
        <span className="dash-skeleton acct-sb-skeleton" />
      </section>
    );
  }

  const rate = overview.pricing.usdRate;
  const valueText = `${position}% toward profit`;

  return (
    <section className="dash-card acct-sb" aria-label="Pricing strategy" aria-busy={busy}>
      <div className="acct-sb-strategy">
        <div className="acct-sb-head">
          <label htmlFor="acct-sb-slider" className="acct-sb-title">
            Pricing strategy
            <span className="acct-sb-sr"> — Reach to Profit</span>
          </label>
          <output htmlFor="acct-sb-slider" className="acct-sb-value mr-num">
            {valueText}
          </output>
        </div>
        <div className="acct-sb-scale">
          <span className="acct-sb-end" aria-hidden="true">
            Reach
          </span>
          <input
            id="acct-sb-slider"
            type="range"
            min={0}
            max={100}
            step={5}
            value={position}
            disabled={busy}
            aria-valuetext={valueText}
            className="acct-sb-range"
            style={{ '--acct-sb-pos': `${position}%` } as CSSProperties}
            onChange={(e) => setPosition(Number(e.currentTarget.value))}
            onPointerUp={(e) => commitPosition(e.currentTarget.value)}
            onKeyUp={(e) => commitPosition(e.currentTarget.value)}
            onBlur={(e) => commitPosition(e.currentTarget.value)}
          />
          <span className="acct-sb-end" aria-hidden="true">
            Profit
          </span>
        </div>
        <p className="acct-sb-hint">
          Reach sits each System price low in its band to win customers; Profit moves it toward the top.
        </p>
      </div>

      <div className="acct-sb-rate">
        <label htmlFor="acct-sb-rate" className="acct-sb-rate-label">
          1 USD =
        </label>
        <span className="acct-sb-rate-field">
          <input
            id="acct-sb-rate"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label="EGP per 1 USD"
            className="dash-input acct-sb-rate-input mr-num"
            placeholder="50.85"
            value={rateInput}
            disabled={busy}
            onChange={(e) => setRateInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              commitRate();
            }}
            onBlur={commitRate}
          />
          <span className="acct-sb-rate-unit" aria-hidden="true">
            EGP
          </span>
        </span>
        <span className="acct-sb-rate-age">{rate ? setAgo(rate.setAt, now) : 'not set yet'}</span>
      </div>

      <div className="acct-sb-result" aria-live="polite">
        {busy && <span className="acct-sb-muted">Repricing…</span>}
        {!busy && status?.kind === 'run' && (
          <span>
            {status.prefix && <span className="acct-sb-muted">{status.prefix}: </span>}
            <span className="mr-num">{describeRun(status.run)}</span>
            {status.undoable && (
              <>
                {' · '}
                <button type="button" className="acct-sb-undo" onClick={() => void undo(status.run.id)}>
                  Undo
                </button>
              </>
            )}
          </span>
        )}
        {!busy && status?.kind === 'undone' && (
          <span className="mr-num">Undone · {describeRun(status.run)}</span>
        )}
        {!busy && status?.kind === 'note' && <span className="acct-sb-note">{status.text}</span>}
        {!busy && status?.kind === 'error' && <span className="acct-sb-error">{status.text}</span>}
      </div>
    </section>
  );
}
