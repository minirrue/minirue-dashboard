'use client';

import React from 'react';
import Link from 'next/link';
import {
  listDiscounts,
  listRedemptions,
  type Discount,
  type Redemption,
} from '@/lib/api/discounts';
import { errorMessageToText } from '@/lib/api/client';

function money(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * What this one customer has been given, and what they have actually spent it on.
 *
 * The same rows the Discounts → Usage tab shows, filtered to this person — one
 * query behind both, so the two screens can never disagree about whether
 * somebody has already been compensated.
 *
 * Two lists, not one, because they answer different questions. "Codes issued to
 * them" is what support needs before promising anything else. "Codes they have
 * used" is what tells you whether the last apology was ever redeemed.
 *
 * Its own component rather than more markup in CustomerDetailClient: that file
 * is already a thousand lines, and this fetches its own data on its own
 * failure path.
 */
export default function CustomerDiscountUsage({
  customerId,
}: {
  customerId: string;
}) {
  const [used, setUsed] = React.useState<Redemption[]>([]);
  const [issued, setIssued] = React.useState<Discount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [redemptions, all] = await Promise.all([
          listRedemptions({ customerId, limit: 100 }),
          // Personal codes are the only ones "issued to" anybody — a global
          // code belongs to nobody, so listing it here would be noise on every
          // customer in the shop.
          listDiscounts(true),
        ]);
        if (cancelled) return;
        setUsed(redemptions);
        setIssued(all.filter((d) => d.ownerCustomerId === customerId));
      } catch (e) {
        if (!cancelled) setError(errorMessageToText(e, 'Could not load discount usage'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const totalSavedMinor = used.reduce((s, r) => s + r.amountMinor, 0);

  return (
    <section className="dash-form-section" style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2 className="dash-section-title" style={{ margin: 0 }}>
          Discounts ({used.length})
        </h2>
        {used.length > 0 && (
          <span className="dash-help-text" style={{ margin: 0 }}>
            EGP {money(totalSavedMinor)} given away to this customer so far
          </span>
        )}
      </div>

      {error && <p className="dash-inline-error" style={{ marginBottom: 10 }}>{error}</p>}

      {loading ? (
        <p className="dash-help-text">Loading discounts…</p>
      ) : (
        <>
          {issued.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 className="dash-label" style={{ marginBottom: 8 }}>
                Codes made for them
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {issued.map((d) => {
                  const spent = used.some((u) => u.discountId === d.id);
                  const dead =
                    !!d.killedAt ||
                    (!!d.expiresAt && new Date(d.expiresAt) <= new Date());
                  return (
                    <div
                      key={d.id}
                      style={{
                        padding: '10px 14px',
                        border: '1px solid var(--mr-dash-hair)',
                        borderRadius: 'var(--mr-radius-sm)',
                        fontSize: 14,
                        color: 'var(--mr-fg-2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        opacity: dead && !spent ? 0.55 : 1,
                      }}
                    >
                      <span>
                        <code className="dash-slug">{d.code}</code>{' '}
                        {d.valueType === 'PERCENT'
                          ? `${d.percent}% off`
                          : `EGP ${money(d.amountMinor ?? 0)} off`}
                        {d.source === 'SUPPORT' && ' · from a support chat'}
                        {d.note ? ` · ${d.note}` : ''}
                      </span>
                      <span className="dash-muted">
                        {/* Plain words, not a status badge: "used" and "still
                            unused" are what someone actually needs to know
                            before offering the customer anything else. */}
                        {spent
                          ? 'Used'
                          : d.killedAt
                            ? 'Stopped'
                            : dead
                              ? 'Expired unused'
                              : 'Not used yet'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <h3 className="dash-label" style={{ marginBottom: 8 }}>
            Codes they have used
          </h3>
          {used.length === 0 ? (
            <p className="dash-help-text">
              This customer has never used a discount code.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {used.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid var(--mr-dash-hair)',
                    borderRadius: 'var(--mr-radius-sm)',
                    fontSize: 14,
                    color: 'var(--mr-fg-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    <code className="dash-slug">{r.code ?? 'bundle'}</code>{' '}
                    on{' '}
                    <Link className="dash-link" href={`/orders/${r.orderId}`}>
                      {r.orderNumber ?? r.orderId.slice(0, 8)}
                    </Link>
                  </span>
                  <span>
                    −{r.currency} {money(r.amountMinor)}{' '}
                    <span className="dash-muted">
                      · {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
