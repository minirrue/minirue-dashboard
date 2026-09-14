'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatEgpMinor } from '@/components/dashboard/charts';
import { apiAccountingOverview, type AccountingOverview } from '@/lib/api/accounting';
import PricingDrawer, { MODE, formatSignedEgp, type PriceRow } from './PricingDrawer';
import './prices-tab.css';

interface Economics {
  costMinor: number | null;
  marginBp: number | null;
  profitMinor: number | null;
}

/**
 * Margin and profit at the price customers actually pay (the live price), so a
 * My price row shows what it really earns, not what the System price would.
 * Cost is today's cost from the trace, else a fixed EGP cost.
 */
function economicsOf(item: PriceRow, fulfillmentMinor: number): Economics {
  const { row } = item;
  const traced = row.result?.trace.find((t) => t.step === 'COST')?.valueMinor ?? null;
  const fixed =
    item.kind === 'variant' && item.row.costCurrency === 'EGP' && !item.row.followsUsd
      ? item.row.costAmountMinor
      : null;
  const costMinor = traced ?? fixed;
  if (costMinor === null) return { costMinor, marginBp: null, profitMinor: null };
  const price = row.livePriceMinor;
  return {
    costMinor,
    marginBp: price > 0 ? ((price - costMinor) * 10000) / price : null,
    profitMinor: price - costMinor - fulfillmentMinor,
  };
}

function formatMargin(bp: number): string {
  const pct = Math.round(bp / 10) / 10;
  return pct < 0 ? `−${Math.abs(pct).toFixed(1)}%` : `${pct.toFixed(1)}%`;
}

function keyOf(item: PriceRow): string {
  return item.kind === 'variant' ? `v:${item.row.variantId}` : `s:${item.row.bundleId}`;
}

function WarningCount({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="acct-prices-none" aria-label="No warnings">
        —
      </span>
    );
  }
  const label = `${count} ${count === 1 ? 'warning' : 'warnings'}`;
  return (
    <span className="acct-prices-warn" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span className="mr-num" aria-hidden="true">
        {count}
      </span>
    </span>
  );
}

/**
 * Prices tab (minirue-dashboard#57): every house variant and set with its
 * mode, cost, market, both floors, price, margin, profit and warning count.
 * A row opens the pricing drawer.
 */
export default function PricesTab() {
  const [overview, setOverview] = useState<AccountingOverview | null>(null);
  const [error, setError] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    apiAccountingOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const items = useMemo<PriceRow[]>(
    () =>
      overview
        ? [
            ...overview.variants.map((row): PriceRow => ({ kind: 'variant', row })),
            ...overview.sets.map((row): PriceRow => ({ kind: 'set', row })),
          ]
        : [],
    [overview],
  );
  const fulfillmentMinor = useMemo(
    () => overview?.pricing.fulfillmentItems.reduce((sum, i) => sum + i.amountMinor, 0) ?? 0,
    [overview],
  );
  const openItem = items.find((i) => keyOf(i) === openKey) ?? null;
  const withWarnings = items.filter((i) => i.row.warnings.length > 0).length;

  if (error) {
    return (
      <section className="dash-card acct-prices-state" role="alert">
        <p>Could not load prices. Check your connection and try again.</p>
        <button type="button" className="dash-btn-secondary" 
          onClick={() => {
            setError(false);
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
      <section className="dash-card acct-prices" aria-busy="true" aria-label="Loading prices">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="dash-skeleton acct-prices-skeleton" />
        ))}
      </section>
    );
  }

  return (
    <section className="dash-card acct-prices" aria-labelledby="acct-prices-title">
      <header className="acct-prices-head">
        <h2 id="acct-prices-title" className="dash-section-title">
          Prices
        </h2>
        <p className="acct-prices-summary">
          <span className="mr-num">{items.length}</span> {items.length === 1 ? 'item' : 'items'}
          {withWarnings > 0 && (
            <>
              {' · '}
              <span className="mr-num">{withWarnings}</span> with warnings
            </>
          )}
          {' · '}Profit is after <span className="mr-num">{formatEgpMinor(fulfillmentMinor)}</span> box &amp; trip
        </p>
      </header>

      {items.length === 0 ? (
        <p className="acct-prices-empty">No house products yet. Items you add to the catalogue appear here.</p>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table acct-prices-table" aria-label="Prices">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Mode</th>
                <th scope="col" className="acct-num">Cost</th>
                <th scope="col" className="acct-num">Market</th>
                <th scope="col" className="acct-num">Law 1 / no-loss floor</th>
                <th scope="col" className="acct-num">Price</th>
                <th scope="col" className="acct-num">Margin</th>
                <th scope="col" className="acct-num">Profit</th>
                <th scope="col" className="acct-num">Warnings</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const { row } = item;
                const key = keyOf(item);
                const econ = economicsOf(item, fulfillmentMinor);
                const floors = row.result?.floors ?? null;
                const market = row.result?.marketMinor ?? null;
                const belowNoLoss = floors !== null && row.livePriceMinor < floors.noLossShownMinor;
                const belowLaw1 = floors !== null && row.livePriceMinor < floors.law1ShownMinor;
                const name = item.kind === 'variant' ? item.row.productName : item.row.bundleName;
                const detail = item.kind === 'variant' ? item.row.variantLabel : 'Set';
                return (
                  <tr key={key} className="acct-prices-row" onClick={() => setOpenKey(key)}>
                    <td data-label="Item" className="acct-prices-item">
                      <button
                        type="button"
                        className="acct-prices-open"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenKey(key);
                        }}
                      >
                        <span className="acct-prices-name">{name}</span>{' '}
                        <span className="acct-prices-detail">{detail}</span>
                      </button>
                    </td>
                    <td data-label="Mode">
                      <span className="acct-prices-mode" data-mode={row.mode}>
                        {MODE[row.mode].label}
                      </span>
                    </td>
                    <td data-label="Cost" className="acct-num">
                      {econ.costMinor === null ? (
                        <span className="acct-prices-missing">No cost</span>
                      ) : (
                        <span className="mr-num">{formatEgpMinor(econ.costMinor)}</span>
                      )}
                    </td>
                    <td data-label="Market" className="acct-num">
                      {market === null ? (
                        <span className="acct-prices-none">None</span>
                      ) : (
                        <span className="mr-num">{formatEgpMinor(market)}</span>
                      )}
                    </td>
                    <td data-label="Law 1 / no-loss" className="acct-num">
                      {floors ? (
                        <span className="acct-prices-floors mr-num">
                          <span>{formatEgpMinor(floors.law1ShownMinor)}</span>
                          <span className="acct-prices-sub">{formatEgpMinor(floors.noLossShownMinor)}</span>
                        </span>
                      ) : (
                        <span className="acct-prices-none">—</span>
                      )}
                    </td>
                    <td data-label="Price" className="acct-num">
                      <span
                        className="acct-prices-price mr-num"
                        data-tone={belowNoLoss ? 'danger' : belowLaw1 ? 'warn' : undefined}
                      >
                        {formatEgpMinor(row.livePriceMinor)}
                      </span>
                      {(belowNoLoss || belowLaw1) && (
                        <span className="acct-prices-sub" data-tone={belowNoLoss ? 'danger' : 'warn'}>
                          {belowNoLoss ? 'Below no-loss' : 'Below Law 1'}
                        </span>
                      )}
                    </td>
                    <td data-label="Margin" className="acct-num">
                      {econ.marginBp === null ? (
                        <span className="acct-prices-none">—</span>
                      ) : (
                        <span className="mr-num" data-tone={econ.marginBp < 0 ? 'danger' : undefined}>
                          {formatMargin(econ.marginBp)}
                        </span>
                      )}
                    </td>
                    <td data-label="Profit" className="acct-num">
                      {econ.profitMinor === null ? (
                        <span className="acct-prices-none">Unknown</span>
                      ) : (
                        <span className="mr-num" data-tone={econ.profitMinor < 0 ? 'danger' : undefined}>
                          {formatSignedEgp(econ.profitMinor)}
                        </span>
                      )}
                    </td>
                    <td data-label="Warnings" className="acct-num">
                      <WarningCount count={row.warnings.length} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openItem && (
        <PricingDrawer
          key={openKey}
          item={openItem}
          fulfillmentMinor={fulfillmentMinor}
          onClose={() => setOpenKey(null)}
        />
      )}
    </section>
  );
}
