'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PricingWarning } from '@/lib/api/accounting';
import { usePricingWarnings } from '@/lib/hooks/use-pricing-warnings';
import { IconWarningTriangle } from '@/components/dashboard/PricingWarningsLink';
import './warnings-tab.css';

/** Worst first: money lost, then Law 1, then protection gaps, then missing facts. */
const KIND_GUIDE: Record<string, { heading: string; todo: string; tone: 'danger' | 'warn' }> = {
  LOSES_MONEY: {
    heading: 'Loses money',
    todo: 'Every delivered order loses money. Raise the price to at least the no-loss floor, or check the cost is right.',
    tone: 'danger',
  },
  OFFER_BELOW_LAW1: {
    heading: 'Offer puts products below Law 1',
    todo: 'The running sitewide offer leaves profit only from the delivery fee. Lower the offer in Discounts, or accept it for a short push.',
    tone: 'danger',
  },
  BELOW_LAW1: {
    heading: 'Below Law 1',
    todo: 'The price covers the cost but not the box and trip, so profit comes only from the delivery fee. Raise it to the Law 1 floor or switch to System price.',
    tone: 'warn',
  },
  DISCOUNT_CAPPED: {
    heading: 'Discount capped',
    todo: 'The offer stops at the no-loss floor, so shoppers get less off than advertised. Lower the offer or raise the price.',
    tone: 'warn',
  },
  CANT_COMPETE: {
    heading: 'Can’t compete',
    todo: 'The market sells below your Law 1 floor. Find a cheaper cost, or sell on something other than price.',
    tone: 'warn',
  },
  THIN_MARGIN: {
    heading: 'Thin margin',
    todo: 'Above the floors but under your minimum margin. Raise the price a little, or lower the minimum in Costs & rules.',
    tone: 'warn',
  },
  NO_COST: {
    heading: 'No cost entered',
    todo: 'Without a cost there is no floor, so discounts can sell it at a loss. Enter what one unit cost you.',
    tone: 'warn',
  },
  NO_MARKET: {
    heading: 'No market price',
    todo: 'Customers know this exact price. Add at least one competitor price so the system can check against it.',
    tone: 'warn',
  },
  STALE_MARKET: {
    heading: 'Stale market price',
    todo: 'A competitor price is old or predates the last USD rate change. Check the competitor again and update it.',
    tone: 'warn',
  },
};
const KIND_ORDER = Object.keys(KIND_GUIDE);

export interface WarningGroup {
  kind: string;
  items: PricingWarning[];
}

/** Items grouped by kind in KIND_ORDER; a kind a newer backend adds goes last. */
export function groupWarnings(items: PricingWarning[]): WarningGroup[] {
  const byKind = new Map<string, PricingWarning[]>();
  for (const item of items) {
    const list = byKind.get(item.kind) ?? [];
    list.push(item);
    byKind.set(item.kind, list);
  }
  const rank = (kind: string) => {
    const i = KIND_ORDER.indexOf(kind);
    return i === -1 ? KIND_ORDER.length : i;
  };
  return [...byKind.entries()]
    .map(([kind, list]) => ({ kind, items: list }))
    .sort((a, b) => rank(a.kind) - rank(b.kind));
}

/**
 * Where a warning is fixed. The key is `${kind}:${variantId|bundleId|'shop'}`:
 * a variant opens its Prices row, a set (no variantId) opens its set row, and
 * the shop-wide offer warning goes to Discounts.
 */
export function warningHref(w: PricingWarning): string {
  if (w.variantId) return `/accounting?tab=prices&open=${encodeURIComponent(w.variantId)}`;
  const id = w.key.slice(w.key.indexOf(':') + 1);
  if (!id || id === 'shop') return '/discounts';
  return `/accounting?tab=prices&openSet=${encodeURIComponent(id)}`;
}

function linkLabel(w: PricingWarning): string {
  if (w.variantId) return 'Open in Prices';
  return warningHref(w) === '/discounts' ? 'Open Discounts' : 'Open set in Prices';
}

function plural(n: number, word: string) {
  return `${n} ${n === 1 ? word : `${word}s`}`;
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * Warnings tab (minirue-dashboard#61): the `warnings/check` items, read from the
 * same hook as the topbar count so the two never disagree. `?product=<id>`
 * narrows the list to one product (the product page badge links here).
 */
export default function WarningsTab() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const productId = params.get('product');
  const { items, isLoading, isError, recheck } = usePricingWarnings();
  const [checking, setChecking] = useState(false);

  const shown = productId ? items.filter((w) => w.productId === productId) : items;
  const groups = groupWarnings(shown);

  function showAll() {
    const qs = new URLSearchParams(params.toString());
    qs.delete('product');
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  }

  async function checkAgain() {
    setChecking(true);
    try {
      await recheck();
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="dash-card acct-warn" aria-labelledby="acct-warn-title" aria-busy={isLoading || checking}>
      <header className="acct-warn-head">
        <div>
          <h2 id="acct-warn-title" className="dash-section-title">
            Warnings
          </h2>
          <p className="acct-warn-summary" aria-live="polite">
            {isLoading ? (
              'Checking prices…'
            ) : productId ? (
              <>{plural(shown.length, 'warning')} for this product</>
            ) : (
              <>{plural(shown.length, 'warning')}</>
            )}
          </p>
        </div>
        <div className="acct-warn-actions">
          {productId && (
            <button type="button" className="dash-btn-secondary" onClick={showAll}>
              Show all warnings
            </button>
          )}
          <button type="button" className="dash-btn-secondary" onClick={checkAgain} disabled={checking}>
            {checking ? 'Checking…' : 'Check again'}
          </button>
        </div>
      </header>

      {isError && (
        <p className="acct-warn-error" role="alert">
          Could not check prices just now. Try again in a moment.
        </p>
      )}

      {isLoading ? (
        <div className="acct-warn-loading">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="dash-skeleton acct-warn-skeleton" />
          ))}
        </div>
      ) : groups.length === 0 && !isError ? (
        <p className="acct-warn-empty">
          {productId
            ? 'No pricing warnings on this product. Its prices clear both floors.'
            : 'No pricing warnings. Every active item clears both floors and has the facts it needs.'}
        </p>
      ) : (
        <div className="acct-warn-groups">
          {groups.map((group) => {
            const guide = KIND_GUIDE[group.kind];
            const headingId = `acct-warn-${group.kind}`;
            return (
              <section
                key={group.kind}
                className="acct-warn-group"
                data-tone={guide?.tone ?? 'warn'}
                aria-labelledby={headingId}
              >
                <div className="acct-warn-group-head">
                  <h3 id={headingId} className="acct-warn-group-title">
                    <IconWarningTriangle size={15} />
                    {guide?.heading ?? group.kind}
                    <span className="acct-warn-group-count mr-num">{group.items.length}</span>
                  </h3>
                  {guide && <p className="acct-warn-todo">{guide.todo}</p>}
                </div>
                <ul className="acct-warn-items">
                  {group.items.map((w) => (
                    <li key={w.key}>
                      <Link href={warningHref(w)} className="acct-warn-item">
                        <span className="acct-warn-item-text">
                          <span className="acct-warn-item-title">{w.title}</span>
                          <span className="acct-warn-item-detail">{w.detail}</span>
                        </span>
                        <span className="acct-warn-item-go">
                          {linkLabel(w)}
                          <IconArrow />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
