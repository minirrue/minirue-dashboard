'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardCard from '@/components/dashboard/DashboardCard';
import {
  apiGrowthReport,
  type GrowthChannelRow,
  type GrowthRate,
  type GrowthReport,
  type SpendEntry,
} from '@/lib/api/accounting';
import { formatAmount } from '@/lib/accounting/validate';
import { buildUtmLink, type UtmField } from '@/lib/analytics/ad-link';
import SpendLog from './SpendLog';
import './growth-tab.css';

const CHANNEL_LABELS: Record<string, string> = {
  META: 'Meta',
  TIKTOK: 'TikTok',
  GOOGLE: 'Google & YouTube',
  INFLUENCER: 'Influencer',
  OFFLINE: 'Offline',
  OTHER: 'Other',
  PAID: 'Other paid ads',
  SOCIAL: 'Social (unpaid)',
  ORGANIC: 'Search (unpaid)',
  EMAIL: 'Email',
  REFERRAL: 'Referral',
  DIRECT: 'Direct',
};

export function channelLabel(channel: string): string {
  return (
    CHANNEL_LABELS[channel] ??
    channel.charAt(0).toUpperCase() + channel.slice(1).toLowerCase().replace(/_/g, ' ')
  );
}

/** Whole pounds stay whole; anything with piastres shows both digits (EGP 52.50). */
const egp = (minor: number) => {
  const text = formatAmount(minor);
  return `EGP ${minor % 100 === 0 ? text : text.replace(/\.(\d)$/, '.$10')}`;
};
const pct = (rate: number) => `${(rate * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

function lowNote(lowData: boolean, threshold: number): string {
  return lowData ? ` · Low data, under ${threshold}` : '';
}

function errorMessage(e: unknown): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m.trim() !== '' ? m : 'the server did not answer';
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function rateCard(title: string, rate: GrowthRate, detail: string, threshold: number) {
  return {
    title,
    value: rate.rate === null ? 'No orders' : pct(rate.rate),
    sub: `${detail}${lowNote(rate.lowData, threshold)}`,
  };
}

function Cards({ report }: { report: GrowthReport }) {
  const t = report.lowDataThreshold;
  const { orderProfit: op, delivery: dv } = report;

  const profitParts = [
    `n ${op.n}`,
    op.avgMinor === null ? 'average unknown' : `avg ${egp(op.avgMinor)}`,
    op.unknownN > 0 ? `${op.unknownN} with an unknown cost, left out` : 'every cost known',
  ];
  if (op.negativeN > 0) profitParts.push(`${op.negativeN} lost money`);

  let lift: string;
  if (dv.freeDeliveryBreakEvenLiftPct !== null) {
    lift = `free delivery needs ${dv.freeDeliveryBreakEvenLiftPct.toLocaleString('en-US')}% more orders to break even`;
  } else if (op.avgMinor === null) {
    lift = 'free delivery break-even needs known order profit';
  } else {
    lift = 'free delivery cannot break even: an average order earns less than the fee';
  }

  const cards = [
    {
      title: 'Order profit',
      value: op.knownN === 0 ? 'Unknown' : egp(op.totalMinor),
      sub: `${profitParts.join(' · ')}${lowNote(op.lowData, t)}`,
    },
    {
      title: 'Delivery surplus',
      value: `${egp(dv.surplusMinor)} / order`,
      sub: `Fee ${egp(dv.deliveryFeeMinor)} − box & trip ${egp(dv.fulfillmentMinor)} · ${lift} · n ${dv.n}${lowNote(dv.lowData, t)}`,
    },
    {
      title: 'New customers',
      value: report.newCustomers.count.toLocaleString('en-US'),
      sub: `First orders among ${plural(report.newCustomers.n, 'online order', 'online orders')}${lowNote(report.newCustomers.lowData, t)}`,
    },
    rateCard(
      'Repeat orders',
      report.repeat,
      `${report.repeat.orders} of n ${report.repeat.n} online orders came from returning customers`,
      t,
    ),
    rateCard(
      'Refused at the door',
      report.refused,
      `${report.refused.count} of n ${report.refused.n} shipments failed or came back`,
      t,
    ),
    rateCard('Cancelled', report.cancelled, `${report.cancelled.count} of n ${report.cancelled.n} orders`, t),
  ];

  return (
    <div className="acct-growth-cards">
      {cards.map((c, i) => (
        <DashboardCard key={c.title} title={c.title} value={c.value} sub={c.sub} index={i} />
      ))}
    </div>
  );
}

function LeakCell({ row }: { row: GrowthChannelRow }) {
  // Without spend there is no cost to leak, whatever the flag says.
  if (row.spendMinor === 0) return <span className="acct-growth-muted">No spend</span>;
  if (row.leak === null) return <span className="acct-growth-muted">Unknown</span>;
  return row.leak ? (
    <span className="acct-growth-pill" data-tone="danger">
      Leaking
    </span>
  ) : (
    <span className="acct-growth-pill" data-tone="ok">
      Pays back
    </span>
  );
}

function Channels({ report }: { report: GrowthReport }) {
  const t = report.lowDataThreshold;
  const rows = report.channels;
  return (
    <section className="dash-form-card acct-growth-card" aria-labelledby="acct-growth-channels">
      <header>
        <h2 id="acct-growth-channels" className="dash-section-title">
          Channels
        </h2>
        <dl className="acct-growth-explain">
          <div>
            <dt>CAC</dt>
            <dd>what you spent to win one new customer: spend ÷ new customers.</dd>
          </div>
          <div>
            <dt>Payback</dt>
            <dd>how many orders like their first one it takes to earn that cost back.</dd>
          </div>
          <div>
            <dt>Leak</dt>
            <dd>
              a new customer costs more than {plural(report.paybackOrders, 'first order earns', 'first orders earn')}, so
              the channel loses money.
            </dd>
          </div>
        </dl>
      </header>

      {rows.length === 0 ? (
        <p className="acct-growth-empty">No ad spend and no new online customers in this period.</p>
      ) : (
        <div className="dash-table-wrap acct-growth-table-wrap">
          <table className="dash-table acct-growth-table">
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col" className="acct-num">
                  Spend
                </th>
                <th scope="col" className="acct-num">
                  New customers
                </th>
                <th scope="col" className="acct-num">
                  CAC
                </th>
                <th scope="col" className="acct-num">
                  First-order profit
                </th>
                <th scope="col" className="acct-num">
                  Payback
                </th>
                <th scope="col">Leak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.channel}>
                  <th scope="row">
                    {channelLabel(r.channel)}
                    <span className="acct-growth-n">
                      n {r.n}
                      {r.lowData && (
                        <span className="acct-growth-low" title={`Fewer than ${t}, so read it as a hint`}>
                          Low data
                        </span>
                      )}
                    </span>
                  </th>
                  <td className="acct-num" data-label="Spend">
                    {r.spendMinor > 0 ? egp(r.spendMinor) : <span className="acct-growth-muted">None logged</span>}
                  </td>
                  <td className="acct-num" data-label="New customers">
                    {r.newCustomers.toLocaleString('en-US')}
                  </td>
                  <td className="acct-num" data-label="CAC">
                    {r.cacMinor !== null ? (
                      egp(r.cacMinor)
                    ) : (
                      <span className="acct-growth-muted">{r.spendMinor > 0 ? 'Nobody won' : 'No spend'}</span>
                    )}
                  </td>
                  <td className="acct-num" data-label="First-order profit">
                    {r.firstOrderProfit.avgMinor !== null ? (
                      egp(r.firstOrderProfit.avgMinor)
                    ) : (
                      <span className="acct-growth-muted">Unknown</span>
                    )}
                    <span className="acct-growth-n">
                      n {r.firstOrderProfit.n}
                      {r.firstOrderProfit.unknownN > 0 && ` · ${r.firstOrderProfit.unknownN} unknown`}
                    </span>
                  </td>
                  <td className="acct-num" data-label="Payback">
                    {r.paybackOrders !== null ? (
                      plural(Number(r.paybackOrders.toFixed(1)), 'order', 'orders')
                    ) : (
                      <span className="acct-growth-muted">—</span>
                    )}
                  </td>
                  <td data-label="Leak">
                    <LeakCell row={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const SOURCES = ['facebook', 'instagram', 'tiktok', 'google', 'youtube'];
const MEDIUMS = ['paid', 'cpc', 'influencer', 'email', 'sms'];

function UtmBuilder({ campaigns }: { campaigns: string[] }) {
  const [form, setForm] = useState({ path: '', source: '', medium: 'paid', campaign: '', content: '' });
  const [copied, setCopied] = useState<'ok' | 'error' | null>(null);
  const result = buildUtmLink(form);
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setCopied(null);
  };
  // Only complain about a field once something is typed into it; the path is optional.
  const errorFor = (k: UtmField) => (!result.ok && form[k].trim() !== '' ? result.errors[k] : undefined);

  const copy = async () => {
    if (!result.ok) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied('ok');
    } catch {
      setCopied('error');
    }
  };

  const text = (k: UtmField | 'content', label: string, placeholder: string, list?: string, hint?: string) => {
    const error = k === 'content' ? undefined : errorFor(k);
    return (
      <div className="dash-field">
        <label className="dash-label" htmlFor={`acct-utm-${k}`}>
          {label}
        </label>
        <input
          id={`acct-utm-${k}`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          className={`dash-input${error ? ' dash-input-error' : ''}`}
          placeholder={placeholder}
          list={list}
          value={form[k]}
          aria-invalid={!!error}
          aria-describedby={error ? `acct-utm-${k}-err` : undefined}
          onChange={(e) => set(k, e.target.value)}
        />
        {error ? (
          <p className="dash-field-error" id={`acct-utm-${k}-err`}>
            {error}
          </p>
        ) : hint ? (
          <p className="dash-help-text">{hint}</p>
        ) : null}
      </div>
    );
  };

  return (
    <section className="dash-form-card acct-growth-card" aria-labelledby="acct-utm-title">
      <header>
        <h2 id="acct-utm-title" className="dash-section-title">
          Ad link builder
        </h2>
        <p className="acct-growth-lede">
          Tag every ad link so its orders land on the right channel. Put the same campaign in the spend log&apos;s
          utm_campaign to tie those orders to what you paid.
        </p>
      </header>
      <div className="acct-utm-grid">
        {text('path', 'Shop page', '/ for the home page, or /products/…', undefined, 'A path or a minirueshop.com link.')}
        {text('source', 'Source', 'facebook', 'acct-utm-sources', 'Where the ad runs.')}
        {text('medium', 'Medium', 'paid', 'acct-utm-mediums', 'The kind of traffic. Use paid (or cpc) so analytics files it under Paid ads.')}
        {text('campaign', 'Campaign', 'eid-lip-oil', 'acct-utm-campaigns')}
        {text('content', 'Content (optional)', 'video-a', undefined, 'Tells two ads in one campaign apart.')}
      </div>
      <datalist id="acct-utm-sources">
        {SOURCES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="acct-utm-mediums">
        {MEDIUMS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="acct-utm-campaigns">
        {campaigns.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="acct-utm-out" aria-live="polite">
        {result.ok ? (
          <>
            <output className="acct-utm-url" htmlFor="acct-utm-path acct-utm-source acct-utm-medium acct-utm-campaign">
              {result.url}
            </output>
            <button type="button" className="dash-btn-primary" onClick={() => void copy()}>
              {copied === 'ok' ? 'Copied' : 'Copy link'}
            </button>
          </>
        ) : (
          <p className="acct-growth-muted">Fill in source, medium and campaign to get the link.</p>
        )}
        {copied === 'error' && (
          <p className="acct-growth-status" role="alert" data-tone="error">
            Could not copy. Select the link and copy it by hand.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Growth tab (minirue-dashboard#64): order profit and the delivery surplus,
 * what each ad channel pays per new customer and whether it pays back, the
 * spend log behind those figures, and a tagged-link builder. Every figure is
 * the backend's (backend#165) with its n; nothing is estimated here.
 */
export default function GrowthTab() {
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [draftRange, setDraftRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [spend, setSpend] = useState<SpendEntry[]>([]);

  const load = useCallback(async (period: { from: string; to: string } | null) => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiGrowthReport(period ?? {});
      setReport(r);
      setDraftRange(r.period);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiGrowthReport()
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setDraftRange(r.period);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSpendChange = useCallback(
    (entries: SpendEntry[], written: boolean) => {
      setSpend(entries);
      if (written) void load(range);
    },
    [load, range],
  );

  const campaigns = useMemo(
    () => [...new Set(spend.map((s) => s.utmCampaign).filter((c): c is string => !!c))],
    [spend],
  );

  const rangeInvalid = !draftRange.from || !draftRange.to || draftRange.to < draftRange.from;

  return (
    <div className="acct-growth">
      <form
        className="acct-growth-period"
        aria-label="Period"
        onSubmit={(e) => {
          e.preventDefault();
          if (rangeInvalid) return;
          setRange(draftRange);
          void load(draftRange);
        }}
      >
        <div className="dash-field">
          <label className="dash-label" htmlFor="acct-growth-from">
            From
          </label>
          <input
            id="acct-growth-from"
            type="date"
            className="dash-input"
            value={draftRange.from}
            onChange={(e) => setDraftRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div className="dash-field">
          <label className="dash-label" htmlFor="acct-growth-to">
            To
          </label>
          <input
            id="acct-growth-to"
            type="date"
            className="dash-input"
            value={draftRange.to}
            onChange={(e) => setDraftRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        <button type="submit" className="dash-btn-secondary" disabled={loading || rangeInvalid}>
          {loading ? 'Loading…' : 'Show'}
        </button>
        <p className="acct-growth-period-text">
          {report
            ? `${formatDay(report.period.from)} – ${formatDay(report.period.to)}, days in Cairo time. Figures under ${report.lowDataThreshold} are marked low data.`
            : 'Last 30 days.'}
          {rangeInvalid && draftRange.from && draftRange.to && ' The end is before the start.'}
        </p>
      </form>

      {error ? (
        <section className="dash-card acct-growth-state" role="alert">
          <p>Could not load growth figures: {error}.</p>
          <button type="button" className="dash-btn-secondary" onClick={() => void load(range)}>
            Try again
          </button>
        </section>
      ) : report === null ? (
        <section className="acct-growth-cards" aria-busy="true" aria-label="Loading growth figures">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="dash-skeleton acct-growth-skeleton" />
          ))}
        </section>
      ) : (
        <>
          <Cards report={report} />
          <Channels report={report} />
        </>
      )}

      <SpendLog onChange={onSpendChange} />
      <UtmBuilder campaigns={campaigns} />

      <p className="acct-growth-footer">
        How each product turns views into orders lives in{' '}
        <Link href="/analytics/products" className="dash-link">
          Analytics → Products
        </Link>
        .
      </p>
    </div>
  );
}
