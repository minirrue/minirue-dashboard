'use client';

import React from 'react';
import {
  PEOPLE_CAP,
  personName,
  shortPath,
  STAGE_LABEL,
  placeLabel,
  realOrNull,
  STOP_REASON_LABEL,
  type FlowFilter,
  type FlowFilterKey,
  type PeopleSort,
  type PersonRow,
} from '@/lib/api/story';
import { formatDateTime } from '@/lib/dates/format';
import RefreshButton from '@/components/dashboard/analytics/RefreshButton';
import { apiSetTrafficFlag } from '@/lib/api/traffic-flags';

export interface PeopleOptions {
  platform: string[];
  country: string[];
}

const STAGES = ['viewed', 'bag', 'checkout_step', 'paid', 'refunded'];
const REASONS = [
  'bounced',
  'browsed_no_product',
  'viewed_not_added',
  'added_then_removed',
  'left_in_bag',
  'left_checkout_contact',
  'left_checkout_address',
  'left_checkout_shipping',
  'left_checkout_payment',
  'payment_failed',
  'bought',
  'refunded',
];
const DEVICES = ['mobile', 'desktop', 'tablet'];
const SORTS: { value: PeopleSort; label: string }[] = [
  { value: 'lastSeenAt', label: 'Last seen' },
  { value: 'firstSeenAt', label: 'First seen' },
  { value: 'revenueMinor', label: 'Revenue' },
  { value: 'orders', label: 'Orders' },
];

const n = (v: number) => v.toLocaleString('en-US');
const egp = (minor: number) => `EGP ${Math.round(minor / 100).toLocaleString('en-US')}`;
const when = (iso: string) => formatDateTime(iso);
const MEDIUM: Record<string, string> = { paid: 'paid ad', social: 'social', organic: 'search', email: 'email', referral: 'link', direct: 'direct' };

function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="ppl-field" htmlFor={id}>
      <span className="ppl-field__label">{label}</span>
      <select id={id} className="dash-select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * Everyone in the range as one table (owner, 2026-09-19): search, filter,
 * sort, and the whole list — no "show more". Filters are the same ones the
 * flow uses, so a chip set here narrows the flow too, and the other way round.
 */
export default function PeopleTable({
  rows,
  loading,
  done,
  error,
  filter,
  setKey,
  q,
  setQ,
  sort,
  setSort,
  options,
  countryName,
  onOpen,
  onExport,
  onRefresh,
  onFlagged,
}: {
  rows: PersonRow[];
  loading: boolean;
  done: boolean;
  error: string | null;
  filter: FlowFilter;
  setKey: (key: FlowFilterKey, value: string) => void;
  q: string;
  setQ: (v: string) => void;
  sort: PeopleSort;
  setSort: (s: PeopleSort) => void;
  options: PeopleOptions;
  countryName: (code: string) => string;
  onOpen: (visitorId: string) => void;
  onExport: (format: 'csv' | 'json') => void;
  onRefresh: () => void;
  onFlagged: () => void;
}) {
  const capped = done && rows.length >= PEOPLE_CAP;
  // "This is us" hides that person everywhere, past and future, until they are
  // restored from the hidden list below (owner, 2026-09-20).
  const [hiding, setHiding] = React.useState<string | null>(null);
  const [flagError, setFlagError] = React.useState<string | null>(null);
  const markOurs = async (visitorId: string) => {
    setHiding(visitorId);
    setFlagError(null);
    try {
      await apiSetTrafficFlag({ subjectType: 'VISITOR', subjectId: visitorId, trafficClass: 'OWNER', reason: 'Marked "This is us" from People' });
      onFlagged();
    } catch {
      setFlagError('That person could not be hidden. Try again.');
    } finally {
      setHiding(null);
    }
  };
  return (
    <section className="ppl" aria-label="People">
      <header className="ppl__head">
        <div>
          <h2 className="cc-block__title">People</h2>
          <p className="cc-block__sub" aria-live="polite">
            {loading && !rows.length
              ? 'Loading everyone in this range…'
              : !done
                ? `${n(rows.length)} loaded, loading the rest…`
                : capped
                  ? `First ${n(rows.length)} shown — narrow the dates or filters to see the rest`
                  : `${n(rows.length)} ${rows.length === 1 ? 'person' : 'people'} — everyone who matches`}
          </p>
        </div>
        <div className="ppl__exports">
          <RefreshButton onRefresh={onRefresh} title="Reload the people list only" />
          <button type="button" className="flow-pill-btn" disabled={!rows.length} onClick={() => onExport('csv')}>Export CSV</button>
          <button type="button" className="flow-pill-btn" disabled={!rows.length} onClick={() => onExport('json')}>JSON</button>
        </div>
      </header>

      <div className="ppl__toolbar">
        <label className="ppl-field ppl-field--search" htmlFor="ppl-q">
          <span className="ppl-field__label">Search</span>
          <input id="ppl-q" className="dash-input dash-input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, visitor #, phone, campaign, product…" />
        </label>
        <Select id="ppl-platform" label="Came from" value={filter.platform} options={options.platform.map((v) => ({ value: v, label: v }))} onChange={(v) => setKey('platform', v)} />
        <Select id="ppl-stage" label="Got to" value={filter.stage} options={STAGES.map((v) => ({ value: v, label: STAGE_LABEL[v] ?? v }))} onChange={(v) => setKey('stage', v)} />
        <Select id="ppl-reason" label="Stopped because" value={filter.reason} options={REASONS.map((v) => ({ value: v, label: STOP_REASON_LABEL[v] ?? v }))} onChange={(v) => setKey('reason', v)} />
        <Select id="ppl-country" label="Country" value={filter.country} options={options.country.map((v) => ({ value: v, label: countryName(v) }))} onChange={(v) => setKey('country', v)} />
        <Select id="ppl-device" label="Device" value={filter.device} options={DEVICES.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} onChange={(v) => setKey('device', v)} />
        <label className="ppl-field" htmlFor="ppl-sort">
          <span className="ppl-field__label">Sort by</span>
          <select id="ppl-sort" className="dash-select" value={sort} onChange={(e) => setSort(e.target.value as PeopleSort)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {(error || flagError) && <p className="dash-inline-error">{error ?? flagError}</p>}
      {loading && !rows.length && <span className="dash-skeleton" style={{ display: 'block', height: 240, borderRadius: 12 }} />}

      {rows.length > 0 && (
        <div className="ppl__table" role="table" aria-label="People">
          <div className="ppl__row ppl__row--head" role="row">
            <span role="columnheader">Visitor</span>
            <span role="columnheader">Came from</span>
            <span role="columnheader">Looked at</span>
            <span role="columnheader">Got to</span>
            <span role="columnheader">Stopped because</span>
            <span role="columnheader" className="ppl__num">Orders</span>
            <span role="columnheader">Where</span>
            <span role="columnheader">Last seen</span>
          </div>
          {rows.map((p) => (
            <div key={p.visitorId} role="row" className="ppl__row" tabIndex={0} onClick={() => onOpen(p.visitorId)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(p.visitorId)}>
              <span role="cell" className="ppl__name" data-customer={p.customer?.name ? '' : undefined}>
                <span className="ppl__name-row">
                  {personName(p)}
                  {p.trafficClass !== 'REAL' && <span className="dash-flag-chip" data-class={p.trafficClass}>{p.trafficClass.toLowerCase()}</span>}
                  {p.contactable && <span className="flow-person__contact">can contact</span>}
                  <button
                    type="button"
                    className="ppl__ours-btn"
                    disabled={hiding === p.visitorId}
                    title="This is us — hide this person from analytics, their whole history, not just today"
                    onClick={(e) => {
                      e.stopPropagation();
                      void markOurs(p.visitorId);
                    }}
                  >
                    {hiding === p.visitorId ? '…' : 'This is us'}
                  </button>
                </span>
              </span>
              <span role="cell" className="ppl__src">
                {p.platform ?? 'Direct'}
                {p.medium && p.medium !== 'direct' && <small className="ppl__medium">{MEDIUM[p.medium] ?? p.medium}</small>}
                {p.campaign && !/^__.*__$/.test(p.campaign) && <small title="utm_campaign">{p.campaign}</small>}
                {p.referrerUrl && <small className="ppl__url" title={`Came from ${p.referrerUrl}`}>{p.referrerUrl}</small>}
              </span>
              <span role="cell" className="ppl__muted">
                {p.productsViewed.length ? p.productsViewed.join(', ') : '—'}
                {(p.landingUrl ?? p.landingPath) && (
                  <small className="ppl__url" title={`Landed on ${p.landingUrl ?? p.landingPath}`}>
                    landed on {shortPath(p.landingUrl ?? p.landingPath)}
                  </small>
                )}
              </span>
              <span role="cell">{p.furthestStage ? STAGE_LABEL[p.furthestStage] ?? p.furthestStage : '—'}</span>
              <span role="cell" className="ppl__stop" title={p.stopDetail ?? undefined}>
                {p.orders > 0 ? '—' : p.stopReason ? STOP_REASON_LABEL[p.stopReason] ?? p.stopReason : '—'}
                {p.orders === 0 && p.stopDetail && <small>{p.stopDetail}</small>}
              </span>
              <span role="cell" className="ppl__num">{p.orders ? `${p.orders} · ${egp(p.revenueMinor)}` : p.cartValueMinor ? `bag ${egp(p.cartValueMinor)}` : '—'}</span>
              <span role="cell" className="ppl__muted">{[placeLabel(p.city, p.country, countryName), realOrNull(p.device)].filter(Boolean).join(' · ')}</span>
              <span role="cell" className="ppl__muted ppl__when">{when(p.lastSeenAt)}</span>
            </div>
          ))}
        </div>
      )}
      {done && !rows.length && !error && <p className="flow-note">No one matches. Widen the dates or clear a filter.</p>}
    </section>
  );
}
