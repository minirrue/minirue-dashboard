'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Shuffle, UserCheck } from 'lucide-react';
import Switch from '@/components/dashboard/ui/Switch';
import { errorMessageToText, type ApiError } from '@/lib/api/client';
import {
  drawGiveaway,
  getGiveaway,
  pickGiveawayWinner,
  resetGiveawayDraw,
  saveGiveaway,
  setGiveawayEntrantExcluded,
  voidGiveawayDraw,
  type GiveawayAuditEntry,
  type GiveawayEntrant,
  type GiveawayPool,
  type GiveawayPutBody,
  type GiveawaySettings,
  type GiveawayTopSpender,
  type GiveawayView,
} from '@/lib/api/giveaway';
import { isAdminRole } from '@/lib/auth/roles';
import { useUser } from '@/lib/hooks/use-auth';
import { STOREFRONT_PRODUCTION_ORIGIN } from '@/lib/storefront/origin';
import GiveawayQrCodes, { giveawayPublicUrl } from './GiveawayQrCard';
import PrizeChooser, { prizeBody, prizeDraftFrom, prizeProblem, type PrizeDraft } from './PrizeChooser';
import { useDialogFocus, useMounted } from './useDialogFocus';
import './giveaway.css';

const CAIRO = 'Africa/Cairo';
const CAIRO_TIME = new Intl.DateTimeFormat('en-US', { timeZone: CAIRO, hour: 'numeric', minute: '2-digit' });
const CAIRO_DATE_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: CAIRO,
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const CAIRO_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAIRO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const EGP = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EGP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const COUNT = new Intl.NumberFormat('en-US');

export function egpToMinor(value: string): number {
  const amount = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function minorToEgp(value: number): string {
  return (value / 100).toFixed(2);
}

export function toTwelveHourTime(value: string): { hour: string; minute: string; period: 'AM' | 'PM' } {
  const [rawHour = '0', minute = '00'] = value.split(':');
  const hour24 = Number(rawHour);
  return {
    hour: String(hour24 % 12 || 12),
    minute: minute.padStart(2, '0'),
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
}

export function fromTwelveHourTime(hour: string, minute: string, period: 'AM' | 'PM'): string {
  const normalized = Number(hour) % 12 + (period === 'PM' ? 12 : 0);
  return `${String(normalized).padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

/** Latest qualifier first. The backend sends this order; an older one may not. */
export function latestFirst(entrants: GiveawayEntrant[]): GiveawayEntrant[] {
  const time = (entrant: GiveawayEntrant) => {
    const at = entrant.qualifiedAt ? Date.parse(entrant.qualifiedAt) : Number.NaN;
    return Number.isFinite(at) ? at : Number.NEGATIVE_INFINITY;
  };
  return entrants
    .map((entrant, index) => ({ entrant, index }))
    .sort((a, b) => (time(b.entrant) - time(a.entrant)) || a.index - b.index)
    .map(({ entrant }) => entrant);
}

/**
 * Is `HH:mm` on `day` still ahead of `now` on Cairo's clock? The backend
 * refuses a reveal time that is not (422), so the form checks first.
 */
export function isFutureReveal(day: string, revealTime: string, now: Date): boolean {
  if (Number.isNaN(now.getTime())) return true;
  const parts = Object.fromEntries(CAIRO_CLOCK.formatToParts(now).map((part) => [part.type, part.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${day} ${revealTime}` > `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}`;
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function personName(person: { fullName?: unknown; firstName?: unknown; lastName?: unknown; phone?: unknown }): string {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  return text(person.fullName)
    || [text(person.firstName), text(person.lastName)].filter(Boolean).join(' ')
    || text(person.phone)
    || 'Unnamed buyer';
}

/** Every field an older or newer backend might shape differently, made safe to render once. */
function normaliseView(raw: GiveawayView): GiveawayView {
  const entrants = asList<Partial<GiveawayEntrant> | null>(raw.entrants)
    .filter((entrant): entrant is Partial<GiveawayEntrant> => !!entrant && typeof entrant === 'object' && typeof entrant.key === 'string')
    .map((entrant) => ({
      ...entrant,
      key: entrant.key!,
      registered: entrant.registered === true,
      fullName: personName(entrant),
      firstName: entrant.firstName ?? '',
      lastName: entrant.lastName ?? '',
      phone: entrant.phone ?? null,
      email: entrant.email ?? null,
      totalMinor: finite(entrant.totalMinor) ?? 0,
      orders: asList<GiveawayEntrant['orders'][number]>(entrant.orders),
      eligible: entrant.eligible === true,
      qualifiedAt: typeof entrant.qualifiedAt === 'string' ? entrant.qualifiedAt : null,
      excluded: entrant.excluded === true,
    }));
  return {
    ...raw,
    giveaway: raw.giveaway ?? null,
    prize: raw.prize ?? null,
    defaults: raw.defaults ?? null,
    entrants,
    frozenKeys: Array.isArray(raw.frozenKeys) ? raw.frozenKeys : null,
    draw: raw.draw && typeof raw.draw === 'object' && raw.draw.winner ? raw.draw : null,
    audit: asList<GiveawayAuditEntry>(raw.audit),
  };
}

interface SafeStats {
  entrantCount?: number;
  eligibleCount?: number;
  excludedCount?: number;
  buyerCount?: number;
  totalSpendMinor?: number;
  averageSpendMinor?: number;
  topSpenders: GiveawayTopSpender[];
}

function statsFrom(raw: unknown): SafeStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const stats = raw as Record<string, unknown>;
  return {
    entrantCount: finite(stats.entrantCount),
    eligibleCount: finite(stats.eligibleCount),
    excludedCount: finite(stats.excludedCount),
    buyerCount: finite(stats.buyerCount),
    totalSpendMinor: finite(stats.totalSpendMinor),
    averageSpendMinor: finite(stats.averageSpendMinor),
    topSpenders: asList<Record<string, unknown> | null>(stats.topSpenders)
      .filter((spender): spender is Record<string, unknown> => !!spender && typeof spender === 'object')
      .slice(0, 5)
      .map((spender, index) => ({
        key: typeof spender.key === 'string' ? spender.key : `spender-${index}`,
        fullName: personName(spender),
        totalMinor: finite(spender.totalMinor) ?? 0,
        orderCount: finite(spender.orderCount) ?? 0,
      })),
  };
}

function formatMoney(value: number): string {
  return EGP.format(value / 100);
}

function formatCairo(format: Intl.DateTimeFormat, value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : format.format(date);
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${COUNT.format(count)} ${count === 1 ? one : many}`;
}

function messageFrom(error: unknown, fallback: string): string {
  return errorMessageToText((error as ApiError | undefined)?.message, fallback);
}

function isExcluded(entrant: GiveawayEntrant): boolean {
  return entrant.excluded === true;
}

function isRevealed(view: GiveawayView): boolean {
  if (!view.giveaway) return false;
  const revealAt = Date.parse(view.giveaway.revealAt);
  const now = Date.parse(view.serverTime);
  return Number.isFinite(revealAt) && Number.isFinite(now) && revealAt <= now;
}

function toPutBody(source: GiveawaySettings): GiveawayPutBody {
  return {
    enabled: source.enabled,
    minSpendMinor: source.minSpendMinor,
    countShipping: source.countShipping,
    revealTime: source.revealTime,
    title: source.title,
    prizeProductId: source.prizeProductId ?? null,
    prizeTitle: source.prizeTitle,
    prizeDescription: source.prizeDescription,
    prizeGalleryItemId: source.prizeGalleryItemId,
    terms: source.terms,
  };
}

function usePageVisible(): boolean {
  const [visible, setVisible] = React.useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  React.useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

type PendingAction =
  | { type: 'draw'; entrantCount: number }
  | { type: 'pick'; entrant: GiveawayEntrant }
  | { type: 'reset' }
  | { type: 'void' }
  | { type: 'exclude'; entrant: GiveawayEntrant; excluded: boolean };

function ConfirmActionDialog({
  action,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  action: PendingAction;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}) {
  const mounted = useMounted();
  const [reason, setReason] = React.useState('');
  const dialogRef = React.useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, mounted, onCancel);

  if (!mounted) return null;

  const content = (() => {
    switch (action.type) {
      case 'draw':
        return {
          title: 'Draw a random winner?',
          detail: `This draw includes ${plural(action.entrantCount, 'eligible entrant')} and freezes that list.`,
          confirm: 'Confirm draw',
          danger: false,
        };
      case 'pick':
        return {
          title: `Choose ${action.entrant.fullName} as the winner?`,
          detail: 'Choosing the winner yourself freezes the current list of entrants in the draw.',
          confirm: 'Confirm winner',
          danger: false,
        };
      case 'reset':
        return {
          title: 'Reset this draw?',
          detail: 'The frozen list and winner will be cleared. You can draw again before the reveal.',
          confirm: 'Confirm reset',
          danger: false,
        };
      case 'void':
        return {
          title: 'Void this draw?',
          detail: 'The reason is recorded in the activity log. This cannot be presented as a valid result afterward.',
          confirm: 'Confirm void',
          danger: true,
        };
      case 'exclude':
        return action.excluded
          ? {
            title: `Remove ${action.entrant.fullName} from the draw?`,
            detail: 'They stay on the list under “Removed from draw” and cannot win. You can put them back until a winner is drawn.',
            confirm: 'Remove from draw',
            danger: true,
          }
          : {
            title: `Put ${action.entrant.fullName} back in the draw?`,
            detail: 'They can win again as long as they still meet the minimum spend.',
            confirm: 'Put back in draw',
            danger: false,
          };
    }
  })();

  return createPortal(
    <div className="dash-dialog-overlay">
      <div ref={dialogRef} className="dash-dialog giveaway-dialog" role="dialog" aria-modal="true" aria-labelledby="giveaway-confirm-title">
        <h2 id="giveaway-confirm-title" className="giveaway-dialog-title">{content.title}</h2>
        <p className="dash-dialog-message">{content.detail}</p>
        {action.type === 'void' && (
          <label className="dash-field" htmlFor="giveaway-void-reason">
            <span className="dash-label">Reason for voiding</span>
            <textarea
              id="giveaway-void-reason"
              className="dash-textarea"
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        )}
        {error && <p className="dash-inline-error" role="alert">{error}</p>}
        <div className="dash-form-actions">
          <button
            type="button"
            className={content.danger ? 'dash-btn-danger' : 'dash-btn-primary'}
            disabled={busy || (action.type === 'void' && reason.trim().length < 3)}
            onClick={() => onConfirm(action.type === 'void' ? reason.trim() : undefined)}
          >
            {busy ? 'Working…' : content.confirm}
          </button>
          <button type="button" className="dash-btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SettingsCard({ view, readOnly, onSaved }: {
  view: GiveawayView;
  readOnly: boolean;
  onSaved: () => Promise<void>;
}) {
  const source = view.giveaway ?? view.defaults;
  const [form, setForm] = React.useState<GiveawayPutBody | null>(source ? toPutBody(source) : null);
  const [prize, setPrize] = React.useState<PrizeDraft | null>(source ? prizeDraftFrom(view, source) : null);
  const [minimumEgp, setMinimumEgp] = React.useState(source ? minorToEgp(source.minSpendMinor) : '');
  const [time, setTime] = React.useState(source ? toTwelveHourTime(source.revealTime) : toTwelveHourTime('00:00'));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  if (!form || !prize) {
    return (
      <section className="dash-card giveaway-settings">
        <h2 className="dash-card-title">Settings</h2>
        <p className="dash-panel-empty">No settings or defaults are available for this day.</p>
      </section>
    );
  }

  // Mirrors the backend: a draw fixes who qualifies, and the reveal ends editing of the giveaway itself.
  const revealed = !readOnly && isRevealed(view);
  const drawn = !!view.draw;
  const revealLabel = view.giveaway ? formatCairo(CAIRO_TIME, view.giveaway.revealAt) : null;

  const update = <K extends keyof GiveawayPutBody>(key: K, value: GiveawayPutBody[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setSaved(false);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const current = form;
    if (!current || !prize) return;
    const minSpendMinor = egpToMinor(minimumEgp);
    if (minSpendMinor < 100) {
      setError('Minimum spend must be at least EGP 1.00.');
      return;
    }
    const problem = prizeProblem(prize);
    if (problem) {
      setError(problem);
      return;
    }
    const revealTime = fromTwelveHourTime(time.hour, time.minute, time.period);
    const revealChanged = !view.giveaway || view.giveaway.revealTime !== revealTime;
    if (revealChanged && !isFutureReveal(view.day, revealTime, new Date(view.serverTime))) {
      setError(`Choose a reveal time later than now. It is ${formatCairo(CAIRO_TIME, view.serverTime)} in Cairo.`);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveGiveaway(view.pool, view.day, {
        ...current,
        ...prizeBody(prize),
        minSpendMinor,
        revealTime,
      });
      setSaved(true);
      await onSaved();
    } catch (caught) {
      setError(messageFrom(caught, 'Could not save this giveaway.'));
    } finally {
      setSaving(false);
    }
  }

  const locked = readOnly || saving;
  const detailsLocked = locked || revealed;
  const qualifyLocked = detailsLocked || drawn;

  let status: string;
  if (readOnly) status = 'This day has passed, so its giveaway can only be read.';
  else if (revealed) status = 'The reveal has passed, so the prize, reveal time, and minimum spend are locked. You can still turn the page on or off.';
  else if (!view.giveaway) status = 'Nothing is saved for this day yet. The pool’s defaults are filled in.';
  else if (drawn) status = `A winner is drawn. You can still change the prize and reveal time until ${revealLabel}; reset the draw to change who qualifies.`;
  else status = `You can change the prize, reveal time, and minimum spend until the reveal at ${revealLabel}.`;

  return (
    <section className="dash-card giveaway-settings" aria-labelledby="giveaway-settings-title">
      <div className="giveaway-card-head">
        <div>
          <h2 id="giveaway-settings-title" className="dash-card-title">Settings</h2>
          <p>{status}</p>
        </div>
        {readOnly && <span className="giveaway-readonly">Past day · read only</span>}
        {revealed && <span className="giveaway-readonly">Revealed · locked</span>}
      </div>
      <form onSubmit={submit}>
        <div className="giveaway-switch-row">
          <Switch id="giveaway-enabled" checked={form.enabled} onChange={(value) => update('enabled', value)} label="Page on" disabled={locked} />
          <Switch id="giveaway-shipping" checked={form.countShipping} onChange={(value) => update('countShipping', value)} label="Count delivery fees toward the minimum" disabled={qualifyLocked} />
        </div>
        <div className="dash-form-grid giveaway-form-grid">
          <label className="dash-field" htmlFor="giveaway-minimum">
            <span className="dash-label">Minimum spend (EGP)</span>
            <input id="giveaway-minimum" className="dash-input" type="number" min="1" step="0.01" inputMode="decimal" value={minimumEgp} onChange={(event) => { setMinimumEgp(event.target.value); setSaved(false); }} disabled={qualifyLocked} required />
          </label>
          <fieldset className="giveaway-time-field" disabled={detailsLocked} aria-describedby="giveaway-time-hint">
            <legend className="dash-label">Reveal time</legend>
            <div className="giveaway-time-control">
              <label>
                <span className="giveaway-sr">Reveal hour</span>
                <select className="dash-select" aria-label="Reveal hour" value={time.hour} onChange={(event) => { setTime((current) => ({ ...current, hour: event.target.value })); setSaved(false); }}>
                  {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                </select>
              </label>
              <span aria-hidden>:</span>
              <label>
                <span className="giveaway-sr">Reveal minute</span>
                <select className="dash-select" aria-label="Reveal minute" value={time.minute} onChange={(event) => { setTime((current) => ({ ...current, minute: event.target.value })); setSaved(false); }}>
                  {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')).map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                </select>
              </label>
              <label>
                <span className="giveaway-sr">Reveal period</span>
                <select className="dash-select" aria-label="Reveal period" value={time.period} onChange={(event) => { setTime((current) => ({ ...current, period: event.target.value as 'AM' | 'PM' })); setSaved(false); }}>
                  <option value="AM">AM</option><option value="PM">PM</option>
                </select>
              </label>
            </div>
            <p id="giveaway-time-hint" className="giveaway-field-hint">Cairo time. A new reveal time has to be later than now.</p>
          </fieldset>
          <label className="dash-field giveaway-full" htmlFor="giveaway-title">
            <span className="dash-label">Title</span>
            <input id="giveaway-title" className="dash-input" value={form.title} minLength={1} maxLength={120} onChange={(event) => update('title', event.target.value)} disabled={detailsLocked} required />
          </label>
          <div className="giveaway-full">
            <PrizeChooser
              value={prize}
              disabled={detailsLocked}
              onChange={(next) => { setPrize(next); setSaved(false); }}
              onError={setError}
            />
          </div>
          <label className="dash-field giveaway-full" htmlFor="giveaway-terms">
            <span className="dash-label">Terms</span>
            <textarea id="giveaway-terms" className="dash-textarea giveaway-terms" value={form.terms} maxLength={5000} onChange={(event) => update('terms', event.target.value)} disabled={detailsLocked} />
          </label>
        </div>
        {error && <p className="dash-inline-error" role="alert">{error}</p>}
        {saved && <p className="dash-inline-ok" role="status">Giveaway saved.</p>}
        <div className="dash-form-actions">
          <button type="submit" className="dash-btn-primary" disabled={locked}>
            {saving ? 'Saving…' : view.giveaway ? 'Save giveaway' : "Create this day's giveaway"}
          </button>
        </div>
      </form>
    </section>
  );
}

function metric(value: number | undefined, money = false): string {
  if (value === undefined) return '—';
  return money ? formatMoney(value) : COUNT.format(value);
}

function StatsCard({ view }: { view: GiveawayView | undefined }) {
  const stats = view ? statsFrom(view.stats) : null;
  const isToday = !view || view.day === view.today;
  const top = stats?.topSpenders ?? [];
  return (
    <section className="dash-card giveaway-stats" aria-labelledby="giveaway-stats-title">
      <div className="giveaway-card-head">
        <div>
          <h2 id="giveaway-stats-title" className="dash-card-title">{isToday ? "Today's analytics" : `Analytics for ${view?.day ?? ''}`}</h2>
          <p>Admins only. Live figures for this pool, not the frozen draw.</p>
        </div>
      </div>
      {!view ? (
        <div className="giveaway-stats-loading" aria-busy="true" aria-label="Loading analytics"><span className="dash-skeleton" /><span className="dash-skeleton" /></div>
      ) : !stats ? (
        <p className="dash-panel-empty">Analytics are not available from the server yet. Entrants and the draw still work.</p>
      ) : (
        <>
          <dl className="giveaway-metrics">
            <div><dt>Entrants</dt><dd>{metric(stats.entrantCount)}</dd></div>
            <div><dt>Eligible</dt><dd>{metric(stats.eligibleCount)}</dd></div>
            <div><dt>Removed</dt><dd>{metric(stats.excludedCount)}</dd></div>
            <div><dt>Total spend</dt><dd>{metric(stats.totalSpendMinor, true)}</dd></div>
            <div>
              <dt>Average spend</dt>
              <dd>{metric(stats.averageSpendMinor, true)}</dd>
              {stats.buyerCount !== undefined && <dd className="giveaway-metric-note">per buyer · {plural(stats.buyerCount, 'buyer')}</dd>}
            </div>
          </dl>
          <p className="giveaway-metrics-note">Spend counts every paid buyer in this pool, including those still below the minimum.</p>
          <h3 className="giveaway-subhead" id="giveaway-top-title">{isToday ? 'Top spenders today' : 'Top spenders'}</h3>
          {top.length === 0 ? (
            <p className="giveaway-muted">No spend yet.</p>
          ) : (
            <ol className="giveaway-top" aria-labelledby="giveaway-top-title">
              {top.map((spender, index) => (
                <li key={spender.key} data-top={index === 0 || undefined}>
                  <span className="giveaway-top-rank" aria-hidden="true">{index + 1}</span>
                  <div className="giveaway-top-name">
                    <strong>{spender.fullName}</strong>
                    <span>
                      {index === 0 && <span className="giveaway-top-badge">Top spender</span>}
                      {plural(spender.orderCount, 'order')}
                    </span>
                  </div>
                  <strong className="giveaway-money">{formatMoney(spender.totalMinor)}</strong>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function EntrantDetails({ entrant, id }: { entrant: GiveawayEntrant; id: string }) {
  return (
    <dl id={id} className="giveaway-entrant-details">
      <div><dt>Phone</dt><dd>{entrant.phone || '—'}</dd></div>
      <div><dt>Email</dt><dd>{entrant.email || '—'}</dd></div>
      <div><dt>Orders</dt><dd>{entrant.orders.map((order) => order?.orderNumber).filter(Boolean).join(', ') || '—'}</dd></div>
      <div><dt>Account</dt><dd>{entrant.registered ? 'Registered' : 'Not registered'}</dd></div>
    </dl>
  );
}

function EntrantRow({ entrant, number, removed, readOnly, locked, describedBy, onAction }: {
  entrant: GiveawayEntrant;
  number: number | null;
  removed: boolean;
  readOnly: boolean;
  locked: boolean;
  describedBy: string | undefined;
  onAction: (action: PendingAction) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const detailsId = React.useId();
  return (
    <li className="giveaway-entrant-row" data-removed={removed || undefined}>
      <span className="giveaway-entrant-number" aria-hidden={number === null || undefined}>{number ?? ''}</span>
      <div className="giveaway-entrant-name">
        <strong>{entrant.fullName}</strong>
        {removed
          ? <span className="giveaway-removed-badge">Removed from draw</span>
          : <span className="giveaway-registration" data-registered={entrant.registered}>{entrant.registered ? 'Registered' : 'Not registered'}</span>}
      </div>
      <span className="giveaway-entrant-time">
        {entrant.qualifiedAt
          ? <time dateTime={entrant.qualifiedAt}>{formatCairo(CAIRO_DATE_TIME, entrant.qualifiedAt)}</time>
          : 'Not qualified'}
      </span>
      <strong className="giveaway-money giveaway-entrant-total">{formatMoney(entrant.totalMinor)}</strong>
      {removed ? (
        <button
          type="button"
          className="dash-btn-secondary giveaway-entrant-action"
          aria-label={`Put back in draw: ${entrant.fullName}`}
          aria-describedby={describedBy}
          disabled={readOnly || locked}
          onClick={() => onAction({ type: 'exclude', entrant, excluded: false })}
        >
          Put back
        </button>
      ) : (
        <button
          type="button"
          className="dash-btn-ghost giveaway-entrant-action giveaway-entrant-remove"
          aria-label={`Remove from draw: ${entrant.fullName}`}
          aria-describedby={describedBy}
          disabled={readOnly || locked}
          onClick={() => onAction({ type: 'exclude', entrant, excluded: true })}
        >
          Remove from draw
        </button>
      )}
      <button type="button" className="dash-btn-ghost giveaway-entrant-disclose" aria-label={`Details for ${entrant.fullName}`} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded((current) => !current)}>Details {expanded ? '−' : '+'}</button>
      {expanded && <EntrantDetails entrant={entrant} id={detailsId} />}
    </li>
  );
}

function EntrantsCard({ view, readOnly, onAction }: {
  view: GiveawayView;
  readOnly: boolean;
  onAction: (action: PendingAction) => void;
}) {
  const lockNoteId = React.useId();
  const removedTitleId = React.useId();
  const entrants = latestFirst(view.entrants);
  const inDraw = entrants.filter((entrant) => entrant.eligible && !isExcluded(entrant));
  const removed = entrants.filter(isExcluded);
  const almost = view.entrants
    .filter((entrant) => !entrant.eligible && !isExcluded(entrant))
    .sort((a, b) => b.totalMinor - a.totalMinor);
  // Everyone who reached the minimum, removed or not: the backend's entrantCount.
  const applicants = entrants.filter((entrant) => !!entrant.qualifiedAt || (entrant.eligible && !isExcluded(entrant))).length;
  const minimum = view.giveaway?.minSpendMinor;
  const locked = !!view.draw;
  // The explanation only renders for an editable day; a past day is read only anyway.
  const describedBy = locked && !readOnly ? lockNoteId : undefined;
  return (
    <section className="dash-card giveaway-entrants" aria-labelledby="giveaway-entrants-title">
      <div className="giveaway-card-head">
        <div>
          <h2 id="giveaway-entrants-title" className="dash-card-title">
            Entrants <span className="giveaway-count">{COUNT.format(applicants)}<span className="giveaway-sr"> {applicants === 1 ? 'applicant' : 'applicants'}</span></span>
          </h2>
          <p>
            {plural(applicants, 'applicant')} · {COUNT.format(inDraw.length)} in the draw · {COUNT.format(removed.length)} removed
            <span className="giveaway-head-aside"> · Latest first, refreshed every 5 seconds</span>
          </p>
        </div>
        {view.frozenKeys && <span className="giveaway-frozen">Draw list frozen · {view.frozenKeys.length}</span>}
      </div>
      {locked && !readOnly && (
        <p id={lockNoteId} className="giveaway-lock-note">A winner is drawn. Reset the draw before changing who is in it.</p>
      )}
      {inDraw.length === 0 ? (
        <p className="dash-panel-empty">No one is in the draw for this day yet.</p>
      ) : (
        <>
          <div className="giveaway-entrant-columns" aria-hidden="true">
            <span>#</span><span>Name</span><span>Entered</span><span>Spend</span><span />
          </div>
          <ol className="giveaway-entrant-list" aria-labelledby="giveaway-entrants-title">
            {inDraw.map((entrant, index) => (
              <EntrantRow
                key={entrant.key}
                entrant={entrant}
                number={inDraw.length - index}
                removed={false}
                readOnly={readOnly}
                locked={locked}
                describedBy={describedBy}
                onAction={onAction}
              />
            ))}
          </ol>
        </>
      )}
      {removed.length > 0 && (
        <section className="giveaway-removed" aria-labelledby={removedTitleId}>
          <div className="giveaway-removed-head">
            <h3 id={removedTitleId}>Removed from draw <span className="giveaway-count">{COUNT.format(removed.length)}</span></h3>
            <p>Kept here for the record. They cannot win unless you put them back.</p>
          </div>
          <ul className="giveaway-entrant-list" aria-labelledby={removedTitleId}>
            {removed.map((entrant) => (
              <EntrantRow
                key={entrant.key}
                entrant={entrant}
                number={null}
                removed
                readOnly={readOnly}
                locked={locked}
                describedBy={describedBy}
                onAction={onAction}
              />
            ))}
          </ul>
        </section>
      )}
      {almost.length > 0 && (
        <details className="giveaway-group giveaway-almost">
          <summary>Not qualified yet · {almost.length}</summary>
          <ul>
            {almost.map((entrant) => (
              <li key={entrant.key}>
                <span className="giveaway-group-name">{entrant.fullName}</span>
                <span className="giveaway-group-spend">
                  <strong className="giveaway-money">{formatMoney(entrant.totalMinor)}</strong>
                  {minimum !== undefined && minimum > entrant.totalMinor && (
                    <small>{formatMoney(minimum - entrant.totalMinor)} to go</small>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function revealCountdown(revealAt: string, serverTime: string): string {
  const remaining = Date.parse(revealAt) - Date.parse(serverTime);
  if (!Number.isFinite(remaining)) return '';
  if (remaining <= 0) return 'Reveal time reached';
  const totalMinutes = Math.ceil(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `Reveals in ${days ? `${days}d ` : ''}${hours ? `${hours}h ` : ''}${minutes}m`;
}

function DrawCard({ view, readOnly, onAction }: {
  view: GiveawayView;
  readOnly: boolean;
  onAction: (action: PendingAction) => void;
}) {
  const inDraw = latestFirst(view.entrants).filter((entrant) => entrant.eligible && !isExcluded(entrant));
  const removedCount = view.entrants.filter(isExcluded).length;
  const [choice, setChoice] = React.useState('');
  const chosen = inDraw.find((entrant) => entrant.key === choice) ?? null;
  const count = inDraw.length;
  const winner = view.draw?.winner;

  return (
    <section className="dash-card giveaway-draw" aria-labelledby="giveaway-draw-title">
      <div className="giveaway-card-head"><div><h2 id="giveaway-draw-title" className="dash-card-title">Draw</h2><p>Draw at random or choose the winner yourself. Either way, the list of entrants is frozen at that moment.</p></div></div>
      {!view.giveaway ? (
        <p className="dash-panel-empty">Create this day&apos;s giveaway before drawing.</p>
      ) : !view.draw || !winner ? (
        <div className="giveaway-draw-choices">
          <section className="giveaway-draw-choice" aria-labelledby="giveaway-random-title">
            <h3 id="giveaway-random-title">Random winner</h3>
            <p>
              {count ? `Picks one of the ${plural(count, 'entrant')} in the draw at random.` : 'No entrants are in the draw yet.'}
              {removedCount > 0 && ` ${plural(removedCount, 'removed entrant')} ${removedCount === 1 ? 'is' : 'are'} left out.`}
            </p>
            <button type="button" className="dash-btn-primary" disabled={readOnly || count === 0} onClick={() => onAction({ type: 'draw', entrantCount: count })}>
              <Shuffle size={16} aria-hidden="true" />
              Draw random winner
            </button>
          </section>
          <section className="giveaway-draw-choice" aria-labelledby="giveaway-choose-title">
            <h3 id="giveaway-choose-title">Choose winner</h3>
            <p>Pick the winner yourself from the entrants in the draw.</p>
            <div className="giveaway-choose-row">
              <label className="dash-field" htmlFor="giveaway-choose-winner">
                <span className="dash-label">Winner</span>
                <select id="giveaway-choose-winner" className="dash-select" value={chosen ? choice : ''} onChange={(event) => setChoice(event.target.value)} disabled={readOnly || count === 0}>
                  <option value="">Select an entrant</option>
                  {inDraw.map((entrant) => <option key={entrant.key} value={entrant.key}>{entrant.fullName} · {formatMoney(entrant.totalMinor)}</option>)}
                </select>
              </label>
              <button type="button" className="dash-btn-secondary" disabled={readOnly || !chosen} onClick={() => { if (chosen) onAction({ type: 'pick', entrant: chosen }); }}>
                <UserCheck size={16} aria-hidden="true" />
                Choose winner
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="giveaway-winner">
          {!view.draw.winnerStillEligible && <p className="giveaway-warning" role="alert">This winner is no longer eligible under the current order data.</p>}
          <div className="giveaway-winner-head">
            <div>
              <span>Winner</span>
              <h3>{personName(winner)}</h3>
              <p>{view.draw.method === 'RANDOM' ? 'Drawn at random' : 'Chosen by hand'} from {plural(finite(view.draw.entrantCount) ?? 0, 'entrant')}</p>
            </div>
            <strong>{revealCountdown(view.giveaway.revealAt, view.serverTime)}</strong>
          </div>
          <dl className="giveaway-winner-details">
            <div><dt>Phone</dt><dd>{winner.phone || '—'}</dd></div>
            <div><dt>Email</dt><dd>{winner.email || '—'}</dd></div>
            <div><dt>Account</dt><dd>{winner.registered ? 'Registered' : 'Not registered'}</dd></div>
            <div><dt>Total</dt><dd>{formatMoney(finite(winner.totalMinor) ?? 0)}</dd></div>
            <div><dt>Orders</dt><dd>{asList<{ orderNumber?: string }>(winner.orders).map((order) => order?.orderNumber).filter(Boolean).join(', ') || '—'}</dd></div>
            <div><dt>Method</dt><dd>{view.draw.method === 'RANDOM' ? 'Random' : 'Chosen by hand'}</dd></div>
            <div><dt>Drawn by</dt><dd>{view.draw.drawnBy || '—'}</dd></div>
            <div><dt>Drawn at</dt><dd><time dateTime={view.draw.drawnAt}>{formatCairo(CAIRO_TIME, view.draw.drawnAt)}</time></dd></div>
          </dl>
          <div className="dash-form-actions">
            {!isRevealed(view) && (
              <button type="button" className="dash-btn-secondary" disabled={readOnly} onClick={() => onAction({ type: 'reset' })}>Reset draw</button>
            )}
            <button type="button" className="dash-btn-danger" disabled={readOnly} onClick={() => onAction({ type: 'void' })}>Void draw</button>
          </div>
        </div>
      )}
    </section>
  );
}

const AUDIT_LABELS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  ENABLE: 'Page on',
  DISABLE: 'Page off',
  DRAW: 'Drawn',
  PICK: 'Chosen',
  RESET: 'Reset',
  VOID: 'Voided',
  // Written before backend 0.140.2, when "hide" only masked the public name; it never changed the draw.
  // Since 0.140.2 the old hide route removes from the draw and logs EXCLUDE / INCLUDE like everything else.
  HIDE: 'Name hidden',
  SHOW: 'Name shown',
  EXCLUDE: 'Removed',
  INCLUDE: 'Put back',
};

function detailText(entry: GiveawayAuditEntry, entrants: GiveawayEntrant[]): string {
  if (typeof entry.detail === 'string') return entry.detail;
  if (!entry.detail || typeof entry.detail !== 'object') return '';
  return Object.entries(entry.detail as Record<string, unknown>)
    .map(([key, value]) => {
      // Entrant keys are internal identifiers; show the person, or nothing.
      if (key === 'key') {
        const name = entrants.find((entrant) => entrant.key === value)?.fullName;
        return name ? `entrant: ${name}` : null;
      }
      return `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`;
    })
    .filter((text): text is string => text !== null)
    .join(' · ');
}

function ActivityCard({ entries, entrants }: { entries: GiveawayAuditEntry[]; entrants: GiveawayEntrant[] }) {
  return (
    <section className="dash-card giveaway-activity" aria-labelledby="giveaway-activity-title">
      <div className="giveaway-card-head"><div><h2 id="giveaway-activity-title" className="dash-card-title">Activity</h2><p>Configuration, draw, and entrant changes for this pool and day.</p></div></div>
      {entries.length === 0 ? <p className="dash-panel-empty">No activity yet.</p> : (
        <ol>
          {entries.map((entry, index) => {
            const detail = detailText(entry, entrants);
            const action = String(entry.action ?? '');
            return (
              <li key={entry.id ?? index}>
                <span className="giveaway-audit-action" data-action={action}>{AUDIT_LABELS[action] ?? action}</span>
                <div><strong>{entry.actor}</strong>{detail && <p>{detail}</p>}</div>
                <time dateTime={entry.at}>{formatCairo(CAIRO_TIME, entry.at)}</time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function GiveawayClient() {
  const visible = usePageVisible();
  const mounted = useMounted();
  const { data: user } = useUser();
  const [pool, setPool] = React.useState<GiveawayPool>('BOOTH');
  const [day, setDay] = React.useState('');
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const cancelPending = React.useCallback(() => {
    setPending(null);
    setActionError(null);
  }, []);

  const query = useQuery<GiveawayView, ApiError>({
    queryKey: ['giveaway', pool, day || 'today'],
    queryFn: () => getGiveaway(pool, day || undefined),
    staleTime: 0,
    refetchInterval: visible ? 5_000 : false,
  });
  const view = React.useMemo(() => (query.data ? normaliseView(query.data) : undefined), [query.data]);

  async function refresh() {
    await query.refetch();
  }

  async function confirmAction(reason?: string) {
    if (!pending || !view?.giveaway) return;
    setActionBusy(true);
    setActionError(null);
    try {
      switch (pending.type) {
        case 'draw': await drawGiveaway(view.giveaway.id); break;
        case 'pick': await pickGiveawayWinner(view.giveaway.id, pending.entrant.key); break;
        case 'reset': await resetGiveawayDraw(view.giveaway.id); break;
        case 'void': await voidGiveawayDraw(view.giveaway.id, reason ?? ''); break;
        case 'exclude': await setGiveawayEntrantExcluded(view.giveaway.id, pending.entrant.key, pending.excluded); break;
      }
      setPending(null);
      await refresh();
    } catch (caught) {
      setActionError(messageFrom(caught, 'The giveaway action failed.'));
    } finally {
      setActionBusy(false);
    }
  }

  const openAction = (action: PendingAction) => {
    setActionError(null);
    setPending(action);
  };
  // Same environment as the QR codes once the hostname is known.
  const publicHref = giveawayPublicUrl(pool, mounted ? undefined : STOREFRONT_PRODUCTION_ORIGIN);
  const readOnly = !!view && view.day < view.today;
  const showStats = isAdminRole(user?.role);
  const offPool = view && view.day === view.today && view.publicState === 'OFF' ? view.pool : null;

  return (
    <div className="giveaway-page">
      <header className="dash-page-header giveaway-page-header">
        <div><h1 className="dash-page-title">Giveaway</h1><p>Run the daily booth and online draws from one place.</p></div>
        <div className="giveaway-header-actions">
          {view && <span className="giveaway-state" data-state={view.publicState}>{String(view.publicState ?? '').replace('_', ' ')}</span>}
          <a className="dash-btn-secondary" href={publicHref} target="_blank" rel="noreferrer">View public page</a>
        </div>
      </header>

      <div className="giveaway-toolbar">
        <div role="group" aria-label="Giveaway pool" className="dash-tabstrip">
          {(['BOOTH', 'ONLINE'] as const).map((item) => <button key={item} type="button" aria-pressed={pool === item} className={pool === item ? 'dash-btn-primary' : 'dash-btn-secondary'} onClick={() => { setPool(item); setDay(''); setPending(null); }}>{item === 'BOOTH' ? 'Booth' : 'Online'}</button>)}
        </div>
        <label className="giveaway-day" htmlFor="giveaway-day"><span className="dash-label">Day</span><input id="giveaway-day" className="dash-input" type="date" value={day || view?.day || ''} onChange={(event) => { setDay(event.target.value); setPending(null); }} /></label>
      </div>

      <main className="giveaway-stack">
        <div className="giveaway-overview" data-stats={showStats || undefined}>
          {showStats && <StatsCard view={view} />}
          <GiveawayQrCodes offPool={offPool} />
        </div>
        {query.isLoading && <div className="giveaway-loading" aria-label="Loading giveaway" aria-busy="true"><span className="dash-skeleton" /><span className="dash-skeleton" /><span className="dash-skeleton" /></div>}
        {query.error && <div className="dash-error" role="alert"><p>{messageFrom(query.error, 'Could not load this giveaway.')}</p><button type="button" className="dash-btn-secondary" onClick={() => void query.refetch()}>Try again</button></div>}
        {view && (
          <>
            <SettingsCard key={`${view.pool}:${view.day}:${view.giveaway?.version ?? 'new'}`} view={view} readOnly={readOnly} onSaved={refresh} />
            <EntrantsCard view={view} readOnly={readOnly} onAction={openAction} />
            <DrawCard view={view} readOnly={readOnly} onAction={openAction} />
            <ActivityCard entries={view.audit} entrants={view.entrants} />
          </>
        )}
      </main>
      {pending && <ConfirmActionDialog action={pending} busy={actionBusy} error={actionError} onCancel={cancelPending} onConfirm={(reason) => void confirmAction(reason)} />}
    </div>
  );
}
