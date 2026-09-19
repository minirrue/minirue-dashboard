'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useAbandonedCheckouts,
  useAudienceSummary,
  useDataQuality,
  useLiveVisitors,
  usePurchaseReconciliation,
  useRealtime,
  useSources,
  useTech,
  type AnalyticsRangeState,
} from '@/lib/hooks/use-analytics';
import { buildAnalyticsQueryString, egp, type GeoRow, type SourceRow } from '@/lib/api/analytics-insights';
import { apiFetch } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { channelName, composeBrief, pct } from '@/lib/analytics/brief';
import { downloadRows, type ExportFormat, type ExportRow } from '@/lib/analytics/export';
import './command.css';
import { visitorLabel } from '@/components/dashboard/analytics/VisitorName';

/* ── small pieces ──────────────────────────────────────────────────────── */

const n = (v: number | undefined | null) => (v ?? 0).toLocaleString('en-US');
const egpWhole = (minor: number | undefined) => `EGP ${Math.round((minor ?? 0) / 100).toLocaleString('en-US')}`;

function withScope(href: string, range: AnalyticsRangeState): string {
  const q = new URLSearchParams({ from: range.from, to: range.to });
  if (range.traffic === 'all') q.set('traffic', 'all');
  return `${href}${href.includes('?') ? '&' : '?'}${q.toString()}`;
}

/** Export menu for one block: exactly the rows the block shows. */
function ExportMenu({ name, rows, range }: { name: string; rows: ExportRow[]; range: AnalyticsRangeState }) {
  const [open, setOpen] = useState(false);
  const go = (f: ExportFormat) => {
    downloadRows(name, rows, f, range);
    setOpen(false);
  };
  return (
    <div className="cc-export" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button type="button" className="cc-export__btn" aria-expanded={open} aria-haspopup="menu" disabled={rows.length === 0} onClick={() => setOpen((v) => !v)}>
        Export
      </button>
      {open && (
        <div className="cc-export__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => go('csv')}>CSV · Excel, Sheets</button>
          <button type="button" role="menuitem" onClick={() => go('json')}>JSON · AI tools</button>
        </div>
      )}
    </div>
  );
}

function BlockHead({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="cc-block__head">
      <div>
        <h2 className="cc-block__title">{title}</h2>
        {sub ? <p className="cc-block__sub">{sub}</p> : null}
      </div>
      {action}
    </header>
  );
}

function Skeleton({ h = 120 }: { h?: number }) {
  return <span className="dash-skeleton" style={{ display: 'block', height: h, borderRadius: 12 }} />;
}

/* ── the command center ────────────────────────────────────────────────── */

const STAGES = [
  { key: 'visitors', label: 'Visited' },
  { key: 'addToCarts', label: 'Added to cart' },
  { key: 'beginCheckouts', label: 'Checkout' },
  { key: 'orders', label: 'Paid' },
] as const;

/**
 * Analytics & Media — the Overview (dashboard#90, #115). One screen answers
 * the owner's three questions in the order they ask them: how are we doing
 * (brief + truth strip), where is it coming from and where does it leak (the
 * journey by channel), and what is happening right now (live, money). Every
 * figure links on to the screen — and ultimately the visitors — behind it;
 * every block exports what it shows.
 *
 * Ink surfaces are "now" (live, open carts); cream surfaces are the range.
 */
export default function CommandCenter({ range }: { range: AnalyticsRangeState }) {
  const audience = useAudienceSummary(range);
  const channels = useSources(range, 'channel');
  const campaigns = useSources(range, 'campaign');
  const live = useRealtime(range);
  const liveVisitors = useLiveVisitors(range);
  const abandoned = useAbandonedCheckouts(range);
  const quality = useDataQuality(range);
  const recon = usePurchaseReconciliation(range);

  const a = audience.data?.data;
  const channelRows: SourceRow[] = useMemo(
    () => [...(channels.data?.data ?? [])].sort((x, y) => y.visitors - x.visitors),
    [channels.data],
  );
  const campaignRows: SourceRow[] = useMemo(
    () =>
      [...(campaigns.data?.data ?? [])]
        .filter((r) => r.key && r.key !== '(none)' && r.key !== '__CAMPAIGN_NAME__')
        .sort((x, y) => y.revenueMinor - x.revenueMinor || y.orders - x.orders || y.visitors - x.visitors),
    [campaigns.data],
  );
  const openCarts = (abandoned.data?.data ?? []).filter((r) => r.stage !== 'PAID');
  const paidRevenue = channelRows.filter((c) => c.key === 'PAID').reduce((s, c) => s + c.revenueMinor, 0);
  const q = quality.data?.data;
  const excludedShare = q && q.totalEvents > 0 ? pct(q.botEvents, q.totalEvents) : null;

  const brief = a
    ? composeBrief({
        visitors: a.visitors,
        orders: a.purchases,
        revenueMinor: a.revenueMinor,
        channels: channelRows,
        openCarts: { count: openCarts.length, valueMinor: openCarts.reduce((s, r) => s + r.valueMinor, 0) },
      })
    : null;

  const maxVisitors = Math.max(1, ...channelRows.map((c) => c.visitors));

  return (
    <div className="cc">
      {/* 1 ─ Brief */}
      <section className="cc-brief" aria-label="Today's brief">
        <div className="cc-brief__text">
          {brief ? brief.map((s, i) => <p key={i} className={i === 0 ? 'cc-brief__lead' : 'cc-brief__second'}>{s}</p>) : <Skeleton h={56} />}
        </div>
        <Link href={withScope('/analytics/flags', range)} className="cc-purity" title="Who counts: bots, staff, the owner and flagged traffic">
          <span className="cc-purity__dot" data-state={excludedShare === null ? 'unknown' : excludedShare > 50 ? 'warn' : 'ok'} />
          {excludedShare === null ? 'Checking purity…' : range.traffic === 'all' ? 'Showing everything' : `${Math.max(0, Math.round(100 - excludedShare))}% of events real · ${n(q?.botEvents)} left out`}
        </Link>
      </section>

      {/* 2 ─ Truth strip */}
      <section className="cc-truth" aria-label="Headline figures">
        {[
          // Every figure opens the people behind it in Story Flow (#123).
          { label: range.traffic === 'all' ? 'Visitors' : 'Real visitors', value: a ? n(a.visitors) : null, href: '/analytics/flow', note: a ? `${n(a.newVisitors)} new` : '' },
          { label: 'Orders', value: a ? n(a.purchases) : null, href: '/analytics/flow?stage=paid', note: a && a.visitors ? `${pct(a.purchases, a.visitors)}% of visitors` : '' },
          { label: 'Revenue', value: a ? egpWhole(a.revenueMinor) : null, href: '/analytics/flow?stage=paid', note: a && a.purchases ? `${egpWhole(a.revenueMinor / a.purchases)} per order` : '' },
          { label: 'From paid ads', value: channels.data ? egpWhole(paidRevenue) : null, href: '/analytics/acquisition', note: a && a.revenueMinor ? `${pct(paidRevenue, a.revenueMinor)}% of revenue` : '' },
          { label: 'Carts open now', value: abandoned.data ? n(openCarts.length) : null, href: '/analytics/flow?stage=bag', note: openCarts.length ? egpWhole(openCarts.reduce((s, r) => s + r.valueMinor, 0)) : '' },
        ].map((f) => (
          <Link key={f.label} href={withScope(f.href, range)} className="cc-figure">
            <span className="cc-figure__label">{f.label}</span>
            <span className="cc-figure__value">{f.value ?? <span className="dash-skeleton" style={{ display: 'inline-block', width: 90, height: 28 }} />}</span>
            <span className="cc-figure__note">{f.note}</span>
          </Link>
        ))}
      </section>

      <div className="cc-grid">
        {/* 3 ─ The journey, one strand per channel */}
        <section className="cc-block cc-journey" aria-label="The buying journey by channel">
          <BlockHead
            title="The journey"
            sub="Every channel from first visit to paid. The drop between steps is where money leaks."
            action={
              <ExportMenu
                name="journey-by-channel"
                range={range}
                rows={channelRows.map((c) => ({
                  channel: channelName(c.key),
                  visitors: c.visitors,
                  added_to_cart: c.addToCarts,
                  checkout: c.beginCheckouts,
                  paid: c.orders,
                  revenue_egp: Math.round(c.revenueMinor / 100),
                  conversion_pct: pct(c.orders, c.visitors),
                }))}
              />
            }
          />
          {channels.isLoading ? (
            <Skeleton h={180} />
          ) : channelRows.length === 0 ? (
            <p className="cc-empty">No visits in this range yet.</p>
          ) : (
            <div className="cc-strands" role="table" aria-label="Journey by channel">
              <div className="cc-strand cc-strand--head" role="row">
                <span role="columnheader">Channel</span>
                {STAGES.map((s) => <span key={s.key} role="columnheader">{s.label}</span>)}
                <span role="columnheader" className="cc-num">Revenue</span>
              </div>
              {channelRows.map((c) => (
                <Link key={c.key} href={withScope('/analytics/flow', range)} className="cc-strand" role="row" title="Follow these people in Story Flow">
                  <span className="cc-strand__name" role="rowheader">
                    {channelName(c.key)}
                    <span className="cc-strand__bar" style={{ width: `${Math.max(4, (c.visitors / maxVisitors) * 100)}%` }} aria-hidden="true" />
                  </span>
                  {STAGES.map((s, i) => {
                    const value = c[s.key];
                    const prev = i === 0 ? null : c[STAGES[i - 1].key];
                    return (
                      <span key={s.key} className="cc-stage" role="cell">
                        <span className="cc-stage__n">{n(value)}</span>
                        {prev !== null && <span className="cc-stage__rate" data-weak={prev > 0 && value / prev < 0.2 ? true : undefined}>{prev > 0 ? `${pct(value, prev)}%` : '—'}</span>}
                      </span>
                    );
                  })}
                  <span className="cc-num cc-strand__rev" role="cell">{egpWhole(c.revenueMinor)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 4 ─ On site now (ink = live) */}
        <section className="cc-block cc-live" aria-label="On site now">
          <BlockHead
            title="On site now"
            sub={<><span className="cc-live__pulse" aria-hidden="true" />{live.data ? `${n(live.data.data.onlineNow)} shopping right now` : 'Listening…'}</>}
            action={
              <ExportMenu
                name="on-site-now"
                range={range}
                rows={(liveVisitors.data?.data ?? []).map((v) => ({ visitor: v.visitorId, page: v.path, country: v.country, device: v.deviceType, seconds_on_page: v.secondsOnPage, signed_in: !!v.userId }))}
              />
            }
          />
          <ul className="cc-live__list">
            {(liveVisitors.data?.data ?? []).slice(0, 8).map((v) => (
              <li key={v.visitorId}>
                <Link href={withScope(`/analytics/visitors/${v.visitorId}`, range)} className="cc-guest">
                  <span className="cc-guest__id">{visitorLabel(v)}</span>
                  <span className="cc-guest__where">{v.title || v.path || '—'}</span>
                  <span className="cc-guest__meta">{[v.country, v.deviceType, v.userId ? 'signed in' : null].filter(Boolean).join(' · ')} · {Math.round(v.secondsOnPage)}s</span>
                </Link>
              </li>
            ))}
            {liveVisitors.data && liveVisitors.data.data.length === 0 && <li className="cc-live__empty">Nobody on the shop this minute.</li>}
          </ul>
          <Link href={withScope('/analytics/realtime', range)} className="cc-live__more">Open Realtime →</Link>
        </section>

        {/* 3b ─ Who they are: beside the journey it explains */}
        <WhoTheyAre range={range} />

        {/* 5 ─ Campaign board */}
        <section className="cc-block cc-campaigns" aria-label="Campaigns">
          <BlockHead
            title="Campaigns"
            sub="Every campaign that sent a visitor — whatever the platform — ranked by what it earned."
            action={
              <ExportMenu
                name="campaigns"
                range={range}
                rows={campaignRows.map((c) => ({
                  campaign: c.key,
                  visitors: c.visitors,
                  added_to_cart: c.addToCarts,
                  checkout: c.beginCheckouts,
                  orders: c.orders,
                  revenue_egp: Math.round(c.revenueMinor / 100),
                  revenue_per_visitor_egp: c.visitors ? Math.round(c.revenueMinor / c.visitors) / 100 : 0,
                  conversion_pct: pct(c.orders, c.visitors),
                }))}
              />
            }
          />
          {campaigns.isLoading ? (
            <Skeleton h={160} />
          ) : campaignRows.length === 0 ? (
            <p className="cc-empty">No tagged campaigns in this range. Tag every ad link with utm_source, utm_campaign and utm_id so it shows here.</p>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table cc-table">
                <thead>
                  <tr>
                    <th scope="col">Campaign</th>
                    <th scope="col" className="cc-num">Visitors</th>
                    <th scope="col" className="cc-num">Carts</th>
                    <th scope="col" className="cc-num">Orders</th>
                    <th scope="col" className="cc-num">Revenue</th>
                    <th scope="col" className="cc-num">Per visitor</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignRows.slice(0, 8).map((c) => (
                    <tr key={c.key}>
                      <td>
                        <Link href={withScope(`/analytics/flow?campaign=${encodeURIComponent(c.key)}`, range)} className="cc-link" title="Follow the people this campaign brought">
                          {c.key}
                        </Link>
                      </td>
                      <td className="cc-num">{n(c.visitors)}</td>
                      <td className="cc-num">{n(c.addToCarts)}</td>
                      <td className="cc-num">{n(c.orders)}</td>
                      <td className="cc-num">{egpWhole(c.revenueMinor)}</td>
                      <td className="cc-num">{c.visitors ? egp(Math.round(c.revenueMinor / c.visitors)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 6 ─ Money right now (ink = live) */}
        <section className="cc-block cc-money" aria-label="Open carts and checks">
          <BlockHead
            title="Open carts"
            sub="Shoppers who stopped before paying — the recovery list."
            action={
              <ExportMenu
                name="open-carts"
                range={range}
                rows={openCarts.map((r) => ({ visitor: r.visitorId, value_egp: Math.round(r.valueMinor / 100), items: r.itemCount, stage: r.stage, channel: r.channel, campaign: r.campaign, contactable: r.contactable, last_seen: r.lastSeenAt }))}
              />
            }
          />
          <ul className="cc-carts">
            {openCarts.slice(0, 6).map((r, i) => (
              <li key={r.cartId ?? `${r.visitorId}-${i}`}>
                {r.visitorId ? (
                  <Link href={withScope(`/analytics/visitors/${r.visitorId}`, range)} className="cc-cart">
                    <span className="cc-cart__who">{visitorLabel(r)}</span>
                    <span className="cc-cart__value">{egpWhole(r.valueMinor)}</span>
                    <span className="cc-cart__meta">{r.itemCount} {r.itemCount === 1 ? 'item' : 'items'} · {r.stage.toLowerCase().replace(/_/g, ' ')}{r.channel ? ` · ${channelName(r.channel)}` : ''}</span>
                    {r.contactable && <span className="cc-cart__contact">Can be contacted</span>}
                  </Link>
                ) : (
                  <span className="cc-cart"><span className="cc-cart__value">{egpWhole(r.valueMinor)}</span></span>
                )}
              </li>
            ))}
            {abandoned.data && openCarts.length === 0 && <li className="cc-live__empty">No open carts in this range.</li>}
          </ul>
          {recon.data && (
            <Link href={withScope('/analytics/sales', range)} className="cc-recon" data-healthy={recon.data.data.healthy || undefined}>
              {recon.data.data.healthy
                ? `Tracking matches every order (${n(recon.data.data.orders.count)}).`
                : `Tracking and orders disagree — ${n(recon.data.data.orders.count)} orders, ${n(recon.data.data.purchaseEvents.count)} tracked. Review →`}
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── Who they are ──────────────────────────────────────────────────────── */

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/**
 * Devices, countries and new vs returning — the audience behind the journey,
 * set right beside it (they explain each other). Each row opens those people
 * in Story Flow. Countries are shown by name, never as codes.
 */
function WhoTheyAre({ range }: { range: AnalyticsRangeState }) {
  const devices = useTech(range, 'device');
  const audience = useAudienceSummary(range);
  const geo = useQuery({
    queryKey: ['analytics', 'geo', 'country', range],
    queryFn: () => apiFetch<{ data: GeoRow[] }>(`/analytics/geo?${buildAnalyticsQueryString(range, { dimension: 'country' })}`, { auth: true }),
  });
  const deviceRows = [...(devices.data?.data ?? [])].sort((x, y) => y.visitors - x.visitors).slice(0, 3);
  const countryRows = [...(geo.data?.data ?? [])].filter((r) => r.key).sort((x, y) => y.visitors - x.visitors).slice(0, 5);
  const totalD = deviceRows.reduce((s, r) => s + r.visitors, 0) || 1;
  const totalC = (geo.data?.data ?? []).reduce((s, r) => s + r.visitors, 0) || 1;
  const a = audience.data?.data;

  return (
    <section className="cc-block cc-who" aria-label="Who they are">
      <BlockHead
        title="Who they are"
        action={
          <ExportMenu
            name="audience"
            range={range}
            rows={[
              ...deviceRows.map((r) => ({ group: 'device', value: r.key, visitors: r.visitors })),
              ...countryRows.map((r) => ({ group: 'country', value: countryName(r.key), visitors: r.visitors, revenue_egp: Math.round(r.revenueMinor / 100) })),
            ]}
          />
        }
      />
      {a && (
        <p className="cc-who__split">
          <span className="cc-who__big">{pct(a.newVisitors, a.visitors)}%</span> new ·{' '}
          <span className="cc-who__big">{pct(a.returningVisitors, a.visitors)}%</span> came back
        </p>
      )}
      <div className="cc-who__cols">
        <ul className="cc-bars" aria-label="Devices">
          {deviceRows.map((r) => (
            <li key={r.key}>
              <Link href={withScope(`/analytics/flow?device=${encodeURIComponent(r.key.toLowerCase())}`, range)} className="cc-bar">
                <span className="cc-bar__label">{r.key.charAt(0).toUpperCase() + r.key.slice(1)}</span>
                <span className="cc-bar__n">{pct(r.visitors, totalD)}%</span>
                <span className="cc-bar__track" aria-hidden="true"><span style={{ width: `${pct(r.visitors, totalD)}%` }} /></span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="cc-bars" aria-label="Countries">
          {countryRows.map((r) => (
            <li key={r.key}>
              <Link href={withScope(`/analytics/flow?country=${encodeURIComponent(r.key)}`, range)} className="cc-bar">
                <span className="cc-bar__label">{countryName(r.key)}</span>
                <span className="cc-bar__n">{n(r.visitors)}</span>
                <span className="cc-bar__track" aria-hidden="true"><span style={{ width: `${pct(r.visitors, totalC)}%` }} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
