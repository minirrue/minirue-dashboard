'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import GalleryPickerModal from '@/components/dashboard/GalleryPickerModal';
import Switch from '@/components/dashboard/ui/Switch';
import { errorMessageToText, type ApiError } from '@/lib/api/client';
import {
  drawGiveaway,
  getGiveaway,
  pickGiveawayWinner,
  resetGiveawayDraw,
  saveGiveaway,
  setGiveawayEntrantHidden,
  voidGiveawayDraw,
  type GiveawayAuditEntry,
  type GiveawayEntrant,
  type GiveawayPool,
  type GiveawayPutBody,
  type GiveawayView,
} from '@/lib/api/giveaway';
import type { GalleryItem } from '@/lib/gallery/types';
import { storefrontOrigin } from '@/lib/storefront/origin';
import './giveaway.css';

const CAIRO_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Cairo',
  hour: 'numeric',
  minute: '2-digit',
});
const EGP = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EGP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

function formatMoney(value: number): string {
  return EGP.format(value / 100);
}

function formatCairoTime(value: string | null): string {
  return value ? CAIRO_TIME.format(new Date(value)) : '—';
}

function messageFrom(error: unknown, fallback: string): string {
  return errorMessageToText((error as ApiError | undefined)?.message, fallback);
}

function toPutBody(source: GiveawayPutBody): GiveawayPutBody {
  return {
    enabled: source.enabled,
    minSpendMinor: source.minSpendMinor,
    countShipping: source.countShipping,
    revealTime: source.revealTime,
    title: source.title,
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

function useMounted(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type PendingAction =
  | { type: 'draw'; entrantCount: number }
  | { type: 'pick'; entrant: GiveawayEntrant }
  | { type: 'reset' }
  | { type: 'void' }
  | { type: 'hidden'; entrant: GiveawayEntrant; hidden: boolean };

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

  React.useEffect(() => {
    if (!mounted) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const main = document.querySelector<HTMLElement>('.dash-main');
    const previousInert = main?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    if (main) main.inert = true;
    document.body.style.overflow = 'hidden';
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'textarea, button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []);
    focusables()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (main) main.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [mounted, onCancel]);

  if (!mounted) return null;

  const content = (() => {
    switch (action.type) {
      case 'draw':
        return {
          title: 'Draw a random winner?',
          detail: `This draw includes ${action.entrantCount} eligible entrant${action.entrantCount === 1 ? '' : 's'} and freezes that list.`,
          confirm: 'Confirm draw',
        };
      case 'pick':
        return {
          title: `Pick ${action.entrant.fullName} as the winner?`,
          detail: 'This manual draw freezes the current eligible list.',
          confirm: 'Confirm winner',
        };
      case 'reset':
        return {
          title: 'Reset this draw?',
          detail: 'The frozen list and winner will be cleared. You can draw again before the reveal.',
          confirm: 'Confirm reset',
        };
      case 'void':
        return {
          title: 'Void this draw?',
          detail: 'The reason is recorded in the activity log. This cannot be presented as a valid result afterward.',
          confirm: 'Confirm void',
        };
      case 'hidden':
        return {
          title: `${action.hidden ? 'Hide' : 'Show'} ${action.entrant.fullName} publicly?`,
          detail: action.hidden
            ? 'Their entry remains eligible, but their public name and phone tail will be hidden.'
            : 'Their masked name and phone tail will become visible again.',
          confirm: action.hidden ? 'Confirm hide' : 'Confirm show',
        };
    }
  })();

  return createPortal(
    <div className="dash-dialog-overlay">
      <div ref={dialogRef} className="dash-dialog" role="dialog" aria-modal="true" aria-labelledby="giveaway-confirm-title">
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
            className={action.type === 'void' ? 'dash-btn-danger' : 'dash-btn-primary'}
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

function PrizePreview({ view, picked, removed, onRemove, disabled }: {
  view: GiveawayView;
  picked: GalleryItem | null;
  removed: boolean;
  onRemove: () => void;
  disabled: boolean;
}) {
  const url = removed ? null : picked?.url ?? view.prize?.imageUrl ?? null;
  const kind = picked?.kind ?? view.prize?.mediaKind ?? 'image';
  if (!url) return <p className="giveaway-media-empty">No prize image selected.</p>;
  return (
    <div className="giveaway-media-preview">
      {kind === 'video' ? (
        <video src={url} controls muted preload="metadata" aria-label="Prize media preview" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated gallery URLs are already resized by imgproxy.
        <img src={url} alt="Prize preview" />
      )}
      <button type="button" className="dash-btn-ghost" onClick={onRemove} disabled={disabled}>Remove prize image</button>
    </div>
  );
}

function SettingsCard({ view, readOnly, onSaved }: {
  view: GiveawayView;
  readOnly: boolean;
  onSaved: () => Promise<void>;
}) {
  const source = view.giveaway ?? view.defaults;
  const [form, setForm] = React.useState<GiveawayPutBody | null>(source ? toPutBody(source) : null);
  const [minimumEgp, setMinimumEgp] = React.useState(source ? minorToEgp(source.minSpendMinor) : '');
  const [time, setTime] = React.useState(source ? toTwelveHourTime(source.revealTime) : toTwelveHourTime('00:00'));
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [picked, setPicked] = React.useState<GalleryItem | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  if (!form) {
    return (
      <section className="dash-card giveaway-settings">
        <h2 className="dash-card-title">Settings</h2>
        <p className="dash-panel-empty">No settings or defaults are available for this day.</p>
      </section>
    );
  }

  const update = <K extends keyof GiveawayPutBody>(key: K, value: GiveawayPutBody[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setSaved(false);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const current = form;
    if (!current) return;
    const minSpendMinor = egpToMinor(minimumEgp);
    if (minSpendMinor < 100) {
      setError('Minimum spend must be at least EGP 1.00.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveGiveaway(view.pool, view.day, {
        ...current,
        minSpendMinor,
        revealTime: fromTwelveHourTime(time.hour, time.minute, time.period),
      });
      setPicked(null);
      setSaved(true);
      await onSaved();
    } catch (caught) {
      setError(messageFrom(caught, 'Could not save this giveaway.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dash-card giveaway-settings">
      <div className="giveaway-card-head">
        <div>
          <h2 className="dash-card-title">Settings</h2>
          <p>Control the public page, qualification threshold, reveal, and prize copy.</p>
        </div>
        {readOnly && <span className="giveaway-readonly">Past day · read only</span>}
      </div>
      <form onSubmit={submit}>
        <div className="giveaway-switch-row">
          <Switch id="giveaway-enabled" checked={form.enabled} onChange={(value) => update('enabled', value)} label="Page on" disabled={readOnly || saving} />
          <Switch id="giveaway-shipping" checked={form.countShipping} onChange={(value) => update('countShipping', value)} label="Count delivery fees toward the minimum" disabled={readOnly || saving} />
        </div>
        <div className="dash-form-grid giveaway-form-grid">
          <label className="dash-field" htmlFor="giveaway-minimum">
            <span className="dash-label">Minimum spend (EGP)</span>
            <input id="giveaway-minimum" className="dash-input" type="number" min="1" step="0.01" inputMode="decimal" value={minimumEgp} onChange={(event) => { setMinimumEgp(event.target.value); setSaved(false); }} disabled={readOnly || saving} required />
          </label>
          <fieldset className="giveaway-time-field" disabled={readOnly || saving}>
            <legend className="dash-label">Reveal time</legend>
            <div className="giveaway-time-control">
              <label>
                <span className="giveaway-sr">Reveal hour</span>
                <select className="dash-select" aria-label="Reveal hour" value={time.hour} onChange={(event) => setTime((current) => ({ ...current, hour: event.target.value }))}>
                  {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                </select>
              </label>
              <span aria-hidden>:</span>
              <label>
                <span className="giveaway-sr">Reveal minute</span>
                <select className="dash-select" aria-label="Reveal minute" value={time.minute} onChange={(event) => setTime((current) => ({ ...current, minute: event.target.value }))}>
                  {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')).map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                </select>
              </label>
              <label>
                <span className="giveaway-sr">Reveal period</span>
                <select className="dash-select" aria-label="Reveal period" value={time.period} onChange={(event) => setTime((current) => ({ ...current, period: event.target.value as 'AM' | 'PM' }))}>
                  <option value="AM">AM</option><option value="PM">PM</option>
                </select>
              </label>
            </div>
          </fieldset>
          <label className="dash-field giveaway-full" htmlFor="giveaway-title">
            <span className="dash-label">Title</span>
            <input id="giveaway-title" className="dash-input" value={form.title} minLength={1} maxLength={120} onChange={(event) => update('title', event.target.value)} disabled={readOnly || saving} required />
          </label>
          <label className="dash-field" htmlFor="giveaway-prize-title">
            <span className="dash-label">Prize title</span>
            <input id="giveaway-prize-title" className="dash-input" value={form.prizeTitle} maxLength={160} onChange={(event) => update('prizeTitle', event.target.value)} disabled={readOnly || saving} />
          </label>
          <label className="dash-field" htmlFor="giveaway-prize-description">
            <span className="dash-label">Prize description</span>
            <textarea id="giveaway-prize-description" className="dash-textarea" value={form.prizeDescription} maxLength={1000} onChange={(event) => update('prizeDescription', event.target.value)} disabled={readOnly || saving} />
          </label>
          <div className="dash-field giveaway-full">
            <span className="dash-label">Prize image</span>
            <PrizePreview view={view} picked={picked} removed={form.prizeGalleryItemId === null} disabled={readOnly || saving} onRemove={() => { update('prizeGalleryItemId', null); setPicked(null); }} />
            <button type="button" className="dash-btn-secondary giveaway-picker-button" onClick={() => setPickerOpen(true)} disabled={readOnly || saving}>Choose from Gallery</button>
          </div>
          <label className="dash-field giveaway-full" htmlFor="giveaway-terms">
            <span className="dash-label">Terms</span>
            <textarea id="giveaway-terms" className="dash-textarea giveaway-terms" value={form.terms} maxLength={5000} onChange={(event) => update('terms', event.target.value)} disabled={readOnly || saving} />
          </label>
        </div>
        {error && <p className="dash-inline-error" role="alert">{error}</p>}
        {saved && <p className="dash-inline-ok" role="status">Giveaway saved.</p>}
        <div className="dash-form-actions">
          <button type="submit" className="dash-btn-primary" disabled={readOnly || saving}>
            {saving ? 'Saving…' : view.giveaway ? 'Save giveaway' : "Create this day's giveaway"}
          </button>
        </div>
      </form>
      {pickerOpen && (
        <GalleryPickerModal
          imagesOnly
          onClose={() => setPickerOpen(false)}
          onSelect={(item) => {
            if (item.kind !== 'image') {
              setError('Choose an image for the prize.');
              return;
            }
            update('prizeGalleryItemId', item.id);
            setPicked(item);
            setPickerOpen(false);
          }}
        />
      )}
    </section>
  );
}

function EntrantRow({ entrant, index, readOnly, drawn, onAction }: {
  entrant: GiveawayEntrant;
  index: number;
  readOnly: boolean;
  drawn: boolean;
  onAction: (action: PendingAction) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const detailsId = React.useId();
  return (
    <li className="giveaway-entrant-row">
      <span className="giveaway-entrant-number">{index + 1}</span>
      <div className="giveaway-entrant-name"><strong>{entrant.fullName}</strong><span className="giveaway-registration" data-registered={entrant.registered}>{entrant.registered ? 'Registered' : 'Not registered'}</span></div>
      <strong className="giveaway-money giveaway-entrant-total">{formatMoney(entrant.totalMinor)}</strong>
      <div className="giveaway-entrant-visibility"><Switch checked={!entrant.hidden} onChange={() => onAction({ type: 'hidden', entrant, hidden: !entrant.hidden })} label={`${entrant.hidden ? 'Show' : 'Hide'} ${entrant.fullName}`} stateLabels={['Shown', 'Hidden']} disabled={readOnly} /></div>
      <button type="button" className="dash-btn-secondary giveaway-entrant-pick" aria-label={`Pick ${entrant.fullName} as winner`} onClick={() => onAction({ type: 'pick', entrant })} disabled={readOnly || drawn}>Pick as winner</button>
      <button type="button" className="dash-btn-ghost giveaway-entrant-disclose" aria-label={`Details for ${entrant.fullName}`} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded((current) => !current)}>Details {expanded ? '−' : '+'}</button>
      {expanded && (
        <dl id={detailsId} className="giveaway-entrant-details">
          <div><dt>Phone</dt><dd>{entrant.phone || '—'}</dd></div>
          <div><dt>Orders</dt><dd>{entrant.orders.map((order) => order.orderNumber).join(', ') || '—'}</dd></div>
          <div><dt>Qualified at</dt><dd><time dateTime={entrant.qualifiedAt ?? undefined}>{formatCairoTime(entrant.qualifiedAt)}</time></dd></div>
          <div><dt>What the public sees</dt><dd>{entrant.hidden || !entrant.publicName ? 'Hidden' : `${entrant.publicName} · ••${entrant.phoneTail ?? ''}`}</dd></div>
        </dl>
      )}
    </li>
  );
}

function EntrantsCard({ view, readOnly, onAction }: {
  view: GiveawayView;
  readOnly: boolean;
  onAction: (action: PendingAction) => void;
}) {
  const eligible = view.entrants.filter((entrant) => entrant.eligible);
  const almost = view.entrants.filter((entrant) => !entrant.eligible);
  return (
    <section className="dash-card giveaway-entrants">
      <div className="giveaway-card-head">
        <div>
          <h2 className="dash-card-title">Entrants</h2>
          <p>{eligible.length} entrant{eligible.length === 1 ? '' : 's'} · refreshes every 5 seconds while this tab is visible</p>
        </div>
        {view.frozenKeys && <span className="giveaway-frozen">Draw list frozen · {view.frozenKeys.length}</span>}
      </div>
      {eligible.length === 0 ? (
        <p className="dash-panel-empty">No eligible entrants for this day yet.</p>
      ) : (
        <ol className="giveaway-entrant-list">
          {eligible.map((entrant, index) => <EntrantRow key={entrant.key} entrant={entrant} index={index} readOnly={readOnly} drawn={!!view.draw} onAction={onAction} />)}
        </ol>
      )}
      {almost.length > 0 && (
        <details className="giveaway-almost">
          <summary>Almost there · {almost.length}</summary>
          <ul>{almost.map((entrant) => <li key={entrant.key}><span>{entrant.fullName || entrant.phone}</span><strong>{formatMoney(entrant.totalMinor)}</strong></li>)}</ul>
        </details>
      )}
    </section>
  );
}

function revealCountdown(revealAt: string, serverTime: string): string {
  const remaining = new Date(revealAt).getTime() - new Date(serverTime).getTime();
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
  const eligibleCount = view.entrants.filter((entrant) => entrant.eligible).length;

  return (
    <section className="dash-card giveaway-draw">
      <div className="giveaway-card-head"><div><h2 className="dash-card-title">Draw</h2><p>The winner list is frozen at the moment of the draw.</p></div></div>
      {!view.giveaway ? (
        <p className="dash-panel-empty">Create this day&apos;s giveaway before drawing.</p>
      ) : !view.draw ? (
        <div className="giveaway-draw-empty">
          <p>{eligibleCount} eligible entrant{eligibleCount === 1 ? '' : 's'} ready.</p>
          <button type="button" className="dash-btn-primary" disabled={readOnly || eligibleCount === 0} onClick={() => onAction({ type: 'draw', entrantCount: eligibleCount })}>Draw a random winner</button>
        </div>
      ) : (
        <div className="giveaway-winner">
          {!view.draw.winnerStillEligible && <p className="giveaway-warning" role="alert">This winner is no longer eligible under the current order data.</p>}
          <div className="giveaway-winner-head">
            <div><span>Winner</span><h3>{view.draw.winner.fullName}</h3><p>{view.draw.winner.publicName ? `${view.draw.winner.publicName} · ••${view.draw.winner.phoneTail ?? ''}` : 'Hidden publicly'}</p></div>
            {view.giveaway && <strong>{revealCountdown(view.giveaway.revealAt, view.serverTime)}</strong>}
          </div>
          <dl className="giveaway-winner-details">
            <div><dt>Phone</dt><dd>{view.draw.winner.phone || '—'}</dd></div>
            <div><dt>Email</dt><dd>{view.draw.winner.email || '—'}</dd></div>
            <div><dt>Account</dt><dd>{view.draw.winner.registered ? 'Registered' : 'Not registered'}</dd></div>
            <div><dt>Total</dt><dd>{formatMoney(view.draw.winner.totalMinor)}</dd></div>
            <div><dt>Orders</dt><dd>{view.draw.winner.orders.map((order) => order.orderNumber).join(', ') || '—'}</dd></div>
            <div><dt>Method</dt><dd>{view.draw.method === 'RANDOM' ? 'Random' : 'Manual pick'}</dd></div>
            <div><dt>Drawn by</dt><dd>{view.draw.drawnBy}</dd></div>
            <div><dt>Drawn at</dt><dd><time dateTime={view.draw.drawnAt}>{formatCairoTime(view.draw.drawnAt)}</time></dd></div>
          </dl>
          <div className="dash-form-actions">
            {view.giveaway && new Date(view.giveaway.revealAt).getTime() > new Date(view.serverTime).getTime() && (
              <button type="button" className="dash-btn-secondary" disabled={readOnly} onClick={() => onAction({ type: 'reset' })}>Reset draw</button>
            )}
            <button type="button" className="dash-btn-danger" disabled={readOnly} onClick={() => onAction({ type: 'void' })}>Void draw</button>
          </div>
        </div>
      )}
    </section>
  );
}

function detailText(entry: GiveawayAuditEntry, entrants: GiveawayEntrant[]): string {
  if (typeof entry.detail === 'string') return entry.detail;
  if (!entry.detail || typeof entry.detail !== 'object') return '';
  return Object.entries(entry.detail as Record<string, unknown>)
    .map(([key, value]) => {
      if (key === 'key' && (entry.action === 'HIDE' || entry.action === 'SHOW')) {
        const maskedName = entrants.find((entrant) => entrant.key === value)?.publicName;
        return maskedName ? `entrant: ${maskedName}` : null;
      }
      return `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`;
    })
    .filter((text): text is string => text !== null)
    .join(' · ');
}

function ActivityCard({ entries, entrants }: { entries: GiveawayAuditEntry[]; entrants: GiveawayEntrant[] }) {
  return (
    <section className="dash-card giveaway-activity">
      <div className="giveaway-card-head"><div><h2 className="dash-card-title">Activity</h2><p>Configuration, draw, and visibility changes for this pool and day.</p></div></div>
      {entries.length === 0 ? <p className="dash-panel-empty">No activity yet.</p> : (
        <ol>{entries.map((entry) => <li key={entry.id}><span className="giveaway-audit-action">{entry.action}</span><div><strong>{entry.actor}</strong>{detailText(entry, entrants) && <p>{detailText(entry, entrants)}</p>}</div><time dateTime={entry.at}>{formatCairoTime(entry.at)}</time></li>)}</ol>
      )}
    </section>
  );
}

export default function GiveawayClient() {
  const visible = usePageVisible();
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
  const view = query.data;

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
        case 'hidden': await setGiveawayEntrantHidden(view.giveaway.id, pending.entrant.key, pending.hidden); break;
      }
      setPending(null);
      await refresh();
    } catch (caught) {
      setActionError(messageFrom(caught, 'The giveaway action failed.'));
    } finally {
      setActionBusy(false);
    }
  }

  const publicHref = `${storefrontOrigin()}/giveaway/${pool.toLowerCase()}`;
  const readOnly = !!view && view.day < view.today;

  return (
    <div className="giveaway-page">
      <header className="dash-page-header giveaway-page-header">
        <div><h1 className="dash-page-title">Giveaway</h1><p>Run the daily booth and online draws from one place.</p></div>
        <div className="giveaway-header-actions">
          {view && <span className="giveaway-state" data-state={view.publicState}>{view.publicState.replace('_', ' ')}</span>}
          <a className="dash-btn-secondary" href={publicHref} target="_blank" rel="noreferrer">View public page</a>
        </div>
      </header>

      <div className="giveaway-toolbar">
        <div role="group" aria-label="Giveaway pool" className="dash-tabstrip">
          {(['BOOTH', 'ONLINE'] as const).map((item) => <button key={item} type="button" aria-pressed={pool === item} className={pool === item ? 'dash-btn-primary' : 'dash-btn-secondary'} onClick={() => { setPool(item); setDay(''); setPending(null); }}>{item === 'BOOTH' ? 'Booth' : 'Online'}</button>)}
        </div>
        <label className="giveaway-day" htmlFor="giveaway-day"><span className="dash-label">Day</span><input id="giveaway-day" className="dash-input" type="date" value={day || view?.day || ''} onChange={(event) => { setDay(event.target.value); setPending(null); }} /></label>
      </div>

      {query.isLoading && <div className="giveaway-loading" aria-label="Loading giveaway" aria-busy="true"><span className="dash-skeleton" /><span className="dash-skeleton" /><span className="dash-skeleton" /></div>}
      {query.error && <div className="dash-error" role="alert"><p>{messageFrom(query.error, 'Could not load this giveaway.')}</p><button type="button" className="dash-btn-secondary" onClick={() => void query.refetch()}>Try again</button></div>}
      {view && (
        <main className="giveaway-stack">
          <SettingsCard key={`${view.pool}:${view.day}:${view.giveaway?.version ?? 'new'}`} view={view} readOnly={readOnly} onSaved={refresh} />
          <EntrantsCard view={view} readOnly={readOnly} onAction={(action) => { setActionError(null); setPending(action); }} />
          <DrawCard view={view} readOnly={readOnly} onAction={(action) => { setActionError(null); setPending(action); }} />
          <ActivityCard entries={view.audit} entrants={view.entrants} />
        </main>
      )}
      {pending && <ConfirmActionDialog action={pending} busy={actionBusy} error={actionError} onCancel={cancelPending} onConfirm={(reason) => void confirmAction(reason)} />}
    </div>
  );
}
