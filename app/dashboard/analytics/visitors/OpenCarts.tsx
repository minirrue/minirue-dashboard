'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAbandonedCheckouts } from '@/lib/hooks/use-analytics';
import type { AbandonedRow } from '@/lib/api/analytics-insights';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import { apiSetTrafficFlag } from '@/lib/api/traffic-flags';
import { formatDateTime } from '@/lib/dates/format';
import RefreshButton from '@/components/dashboard/analytics/RefreshButton';
import { downloadRows } from '@/lib/analytics/export';

const STAGE_COPY: Record<string, string> = {
  CART_ACTIVE: 'Bag left open',
  BEGIN_CHECKOUT: 'Started checkout',
  PAYMENT_INITIATED: 'Started paying',
  PAYMENT_STUCK: 'Payment stuck',
};

const egp = (minor: number) => `EGP ${Math.round(minor / 100).toLocaleString('en-US')}`;
const held = (iso: string) => {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
};

function name(r: AbandonedRow): string {
  if (r.customer?.name) return r.customer.name;
  if (r.visitorNumber) return `Visitor #${r.visitorNumber.toLocaleString('en-US')}`;
  return 'Unknown visitor';
}

/**
 * Carts sitting open right now — who holds each one, what is in it, how long
 * it has been there, and where that person came from (owner, 2026-09-20:
 * "make us see active carts and who holds it and when"). Each row can be
 * marked "This is us", because a cart the owner filled while testing must
 * never read as demand.
 */
export default function OpenCarts({ range, onFlagged }: { range: AnalyticsRangeState; onFlagged: () => void }) {
  const carts = useAbandonedCheckouts(range);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = carts.data?.data ?? [];
  const total = rows.reduce((s, r) => s + r.valueMinor, 0);

  /**
   * Guest carts carry no account, so nothing links an old test cart back to
   * the owner automatically (owner, 2026-09-20: "those 6 carts are from older
   * dates"). Hiding them all at once is the honest shortcut: he is the only
   * one who knows which were his, and one click beats six.
   */
  const markAllOurs = async () => {
    const ids = rows.map((r) => r.visitorId).filter((v): v is string => !!v);
    if (!ids.length) return;
    setBusy('all');
    setError(null);
    try {
      for (const id of ids) {
        await apiSetTrafficFlag({
          subjectType: 'VISITOR',
          subjectId: id,
          trafficClass: 'OWNER',
          reason: 'Our own carts — hidden in bulk from Open carts',
        });
      }
      await carts.refetch();
      onFlagged();
    } catch {
      setError('Some of them could not be hidden. Refresh and try the rest.');
    } finally {
      setBusy(null);
    }
  };

  const markOurs = async (r: AbandonedRow) => {
    if (!r.visitorId) return;
    setBusy(r.visitorId);
    setError(null);
    try {
      await apiSetTrafficFlag({
        subjectType: 'VISITOR',
        subjectId: r.visitorId,
        trafficClass: 'OWNER',
        reason: 'Our own cart — marked from Open carts',
      });
      await carts.refetch();
      onFlagged();
    } catch {
      setError('That visitor could not be hidden. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="ppl carts" aria-label="Open carts">
      <header className="ppl__head">
        <div>
          <h2 className="cc-block__title">Open carts</h2>
          <p className="cc-block__sub">
            {carts.isLoading
              ? 'Loading…'
              : rows.length
                ? `${rows.length} ${rows.length === 1 ? 'cart' : 'carts'} holding ${egp(total)} — nobody has paid for these yet`
                : 'No open carts in this range.'}
          </p>
        </div>
        <div className="ppl__exports">
          <RefreshButton onRefresh={() => carts.refetch()} title="Reload open carts only" />
          <button
            type="button"
            className="flow-pill-btn"
            disabled={!rows.length || busy === 'all'}
            title="Mark every cart in this list as ours — each one can be restored individually afterwards"
            onClick={() => void markAllOurs()}
          >
            {busy === 'all' ? 'Hiding…' : `These ${rows.length || ''} are all us`}
          </button>
          <button
            type="button"
            className="flow-pill-btn"
            disabled={!rows.length}
            onClick={() =>
              downloadRows(
                'open-carts',
                rows.map((r) => ({
                  holder: name(r),
                  visitor_id: r.visitorId,
                  customer_id: r.customer?.id ?? null,
                  stage: STAGE_COPY[r.stage] ?? r.stage,
                  items: r.itemCount,
                  value_egp: Math.round(r.valueMinor / 100),
                  came_from: r.channel,
                  campaign: r.campaign,
                  contactable: r.contactable,
                  last_seen: r.lastSeenAt,
                })),
                'csv',
                range,
              )
            }
          >
            Export CSV
          </button>
        </div>
      </header>

      {error && <p className="dash-inline-error">{error}</p>}
      {carts.isError && <p className="dash-inline-error">Open carts could not load.</p>}
      {carts.isLoading && <span className="dash-skeleton" style={{ display: 'block', height: 120, borderRadius: 12 }} />}

      {!carts.isLoading && !carts.isError && !rows.length && (
        <p className="flow-note">
          No cart is sitting open in this range. A bag someone already paid for, or one that was emptied, is not an
          open cart — to hide a person who once added to a bag, use “This is us” on their row in People below.
        </p>
      )}

      {!!rows.length && (
        <div className="ppl__table" role="table" aria-label="Open carts">
          <div className="carts__row carts__row--head" role="row">
            <span role="columnheader">Who holds it</span>
            <span role="columnheader">In the bag</span>
            <span role="columnheader">Got to</span>
            <span role="columnheader">Came from</span>
            <span role="columnheader">Held for</span>
            <span role="columnheader">This is us</span>
          </div>
          {rows.map((r) => (
            <div key={r.cartId ?? r.visitorId ?? r.lastSeenAt} className="carts__row" role="row">
              <span role="cell" className="ppl__name">
                {r.visitorId ? (
                  <Link href={`/analytics/visitors/${r.visitorId}`} className="dash-link">{name(r)}</Link>
                ) : (
                  name(r)
                )}
                {r.contactable && <span className="flow-person__contact">can contact</span>}
              </span>
              <span role="cell" className="ppl__num">
                {egp(r.valueMinor)}
                {r.itemCount ? <small className="ppl__url">{r.itemCount} item{r.itemCount === 1 ? '' : 's'}</small> : null}
              </span>
              <span role="cell">{STAGE_COPY[r.stage] ?? r.stage}</span>
              <span role="cell" className="ppl__src">
                {r.channel ?? 'Direct'}
                {r.campaign && <small>{r.campaign}</small>}
              </span>
              <span role="cell" className="ppl__muted ppl__when">
                {held(r.lastSeenAt)}
                <small className="ppl__url">{formatDateTime(r.lastSeenAt)}</small>
              </span>
              <span role="cell">
                <button
                  type="button"
                  className="flow-pill-btn"
                  disabled={!r.visitorId || busy === r.visitorId}
                  title="Hide this person from analytics — their whole history, not just this cart"
                  onClick={() => void markOurs(r)}
                >
                  {busy === r.visitorId ? 'Hiding…' : 'This is us'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
