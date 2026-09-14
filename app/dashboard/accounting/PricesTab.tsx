'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { floorBreach } from '@/app/dashboard/bundles/bundle-economics';
import { formatEgpMinor } from '@/components/dashboard/charts';
import { apiAccountingOverview, type AccountingOverview, type PriceFlag } from '@/lib/api/accounting';
import PricingDrawer, { FLAG_LABELS, MODE, formatSignedEgp } from './PricingDrawer';
import './prices-tab.css';

function formatMargin(bp: number): string {
  const pct = Math.round(bp / 10) / 10;
  return pct < 0 ? `−${Math.abs(pct).toFixed(1)}%` : `${pct.toFixed(1)}%`;
}

/** The engine's own flags for the row. Warnings (backend#164) will replace this count. */
function FlagCount({ flags }: { flags: PriceFlag[] }) {
  const count = flags.length;
  if (count === 0) {
    return (
      <span className="acct-prices-none" aria-label="No flags">
        —
      </span>
    );
  }
  const label = `${count} ${count === 1 ? 'flag' : 'flags'}: ${flags.map((f) => FLAG_LABELS[f] ?? f).join(', ')}`;
  return (
    <span className="acct-prices-warn" aria-label={label} title={label}>
      <WarnIcon />
      <span className="mr-num" aria-hidden="true">
        {count}
      </span>
    </span>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * Prices tab (minirue-dashboard#57, #66): every house variant with its mode,
 * cost, market, both floors, price, margin, profit and engine flags, read from
 * the backend's `OverviewVariantRow`. Margin and profit are the backend's
 * `current` figures, at the price customers pay now. A row opens the pricing
 * drawer, whose saves refetch the overview.
 */
export default function PricesTab() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [overview, setOverview] = useState<AccountingOverview | null>(null);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [highlightSetId, setHighlightSetId] = useState<string | null>(null);
  const [linkParamsApplied, setLinkParamsApplied] = useState(false);
  const setRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

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

  /** After a drawer save: a fresh GET, so the row shows what the backend stored. */
  const refresh = useCallback(async () => {
    setOverview(await apiAccountingOverview());
  }, []);

  const items = overview?.variants ?? [];
  /** Sets (backend#166) list below the variants and open in the bundle editor. */
  const sets = overview?.sets ?? [];
  const fulfillmentMinor = overview?.fees.fulfillmentMinor ?? 0;
  const openRow = items.find((r) => r.variantId === openId) ?? null;
  const withFlags = items.filter((r) => r.system.flags.length > 0).length;

  /**
   * A Warnings-tab link (minirue-dashboard#61, #67) lands here with
   * `?open=<variantId>` or `?openSet=<bundleId>`. Applied once, after the
   * overview loads; an unknown id does nothing. Adjusting state during
   * render (not in an effect) applies it before paint, so there is no
   * open-then-jump flash.
   */
  if (!linkParamsApplied && overview) {
    const openParam = params.get('open');
    const openSetParam = params.get('openSet');
    if (openParam && items.some((r) => r.variantId === openParam)) {
      setOpenId(openParam);
    } else if (openSetParam && sets.some((s) => s.bundleId === openSetParam)) {
      setHighlightSetId(openSetParam);
    }
    setLinkParamsApplied(true);
  }

  useEffect(() => {
    if (!highlightSetId) return;
    setRowRefs.current[highlightSetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightSetId]);

  /** Closing the drawer clears `?open` so a refresh does not reopen it. */
  const closeDrawer = useCallback(() => {
    setOpenId(null);
    if (params.get('open')) {
      const qs = new URLSearchParams(params.toString());
      qs.delete('open');
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    }
  }, [params, pathname, router]);

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
          {sets.length > 0 && (
            <>
              {' · '}
              <span className="mr-num">{sets.length}</span> {sets.length === 1 ? 'set' : 'sets'}
            </>
          )}
          {withFlags > 0 && (
            <>
              {' · '}
              <span className="mr-num">{withFlags}</span> flagged
            </>
          )}
          {' · '}Profit is after <span className="mr-num">{formatEgpMinor(fulfillmentMinor)}</span> box &amp; trip
        </p>
      </header>

      {items.length === 0 && sets.length === 0 ? (
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
                <th scope="col" className="acct-num">Flags</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const floors = row.system.floors;
                const market = row.system.marketMinor;
                const price = row.currentPriceMinor;
                const { marginBp, productProfitMinor } = row.current;
                const belowNoLoss = floors !== null && price < floors.noLossShownMinor;
                const belowLaw1 = floors !== null && price < floors.law1ShownMinor;
                return (
                  <tr key={row.variantId} className="acct-prices-row" onClick={() => setOpenId(row.variantId)}>
                    <td data-label="Item" className="acct-prices-item">
                      <button
                        type="button"
                        className="acct-prices-open"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(row.variantId);
                        }}
                      >
                        <span className="acct-prices-name">{row.productName}</span>{' '}
                        <span className="acct-prices-detail">
                          {row.sku}
                          {!row.isActive && ' · Inactive'}
                        </span>
                      </button>
                    </td>
                    <td data-label="Mode">
                      <span className="acct-prices-mode" data-mode={row.mode}>
                        {MODE[row.mode].label}
                      </span>
                    </td>
                    <td data-label="Cost" className="acct-num">
                      {row.costMinor === null ? (
                        <span className="acct-prices-missing">No cost</span>
                      ) : (
                        <span className="mr-num">{formatEgpMinor(row.costMinor)}</span>
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
                        {formatEgpMinor(price)}
                      </span>
                      {(belowNoLoss || belowLaw1) && (
                        <span className="acct-prices-sub" data-tone={belowNoLoss ? 'danger' : 'warn'}>
                          {belowNoLoss ? 'Below no-loss' : 'Below Law 1'}
                        </span>
                      )}
                    </td>
                    <td data-label="Margin" className="acct-num">
                      {marginBp === null ? (
                        <span className="acct-prices-none">—</span>
                      ) : (
                        <span className="mr-num" data-tone={marginBp < 0 ? 'danger' : undefined}>
                          {formatMargin(marginBp)}
                        </span>
                      )}
                    </td>
                    <td data-label="Profit" className="acct-num">
                      {productProfitMinor === null ? (
                        <span className="acct-prices-none">Unknown</span>
                      ) : (
                        <span className="mr-num" data-tone={productProfitMinor < 0 ? 'danger' : undefined}>
                          {formatSignedEgp(productProfitMinor)}
                        </span>
                      )}
                    </td>
                    <td data-label="Flags" className="acct-num">
                      <FlagCount flags={row.system.flags} />
                    </td>
                  </tr>
                );
              })}
              {sets.map((set) => {
                const floors = set.system?.floors ?? null;
                const price = set.currentPriceMinor;
                const { marginBp, productProfitMinor } = set.current;
                const breach = floorBreach(price, floors);
                const warningLabel = set.warnings.map((w) => w.title).join(', ');
                return (
                  <tr
                    key={set.bundleId}
                    ref={(el) => {
                      setRowRefs.current[set.bundleId] = el;
                    }}
                    className="acct-prices-row"
                    data-kind="set"
                    data-highlight={set.bundleId === highlightSetId ? 'true' : undefined}
                  >
                    <td data-label="Item" className="acct-prices-item">
                      <Link href={`/catalogue/bundles/${set.bundleId}/edit`} className="acct-prices-open">
                        <span className="acct-prices-name">{set.name}</span>{' '}
                        <span className="acct-prices-detail">
                          Set · {set.members.length} {set.members.length === 1 ? 'piece' : 'pieces'}
                          {set.mode === 'SYSTEM' && ` · ${formatMargin(set.effectiveSavingBp)} off`}
                          {!set.isActive && ' · Inactive'}
                        </span>
                      </Link>
                    </td>
                    <td data-label="Mode">
                      <span className="acct-prices-mode" data-mode={set.mode}>
                        {MODE[set.mode].label}
                      </span>
                    </td>
                    <td data-label="Cost" className="acct-num">
                      {set.costMinor === null ? (
                        <span className="acct-prices-missing">No cost</span>
                      ) : (
                        <span className="mr-num">{formatEgpMinor(set.costMinor)}</span>
                      )}
                    </td>
                    <td data-label="Market" className="acct-num">
                      <span className="acct-prices-none">—</span>
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
                        data-tone={breach === 'NO_LOSS' ? 'danger' : breach === 'LAW1' ? 'warn' : undefined}
                      >
                        {formatEgpMinor(price)}
                      </span>
                      {breach && (
                        <span className="acct-prices-sub" data-tone={breach === 'NO_LOSS' ? 'danger' : 'warn'}>
                          {breach === 'NO_LOSS' ? 'Below no-loss' : 'Below Law 1'}
                        </span>
                      )}
                    </td>
                    <td data-label="Margin" className="acct-num">
                      {marginBp === null ? (
                        <span className="acct-prices-none">—</span>
                      ) : (
                        <span className="mr-num" data-tone={marginBp < 0 ? 'danger' : undefined}>
                          {formatMargin(marginBp)}
                        </span>
                      )}
                    </td>
                    <td data-label="Profit" className="acct-num">
                      {productProfitMinor === null ? (
                        <span className="acct-prices-none">Unknown</span>
                      ) : (
                        <span className="mr-num" data-tone={productProfitMinor < 0 ? 'danger' : undefined}>
                          {formatSignedEgp(productProfitMinor)}
                        </span>
                      )}
                    </td>
                    <td data-label="Warnings" className="acct-num">
                      {set.warnings.length === 0 ? (
                        <span className="acct-prices-none" aria-label="No warnings">
                          —
                        </span>
                      ) : (
                        <span
                          className="acct-prices-warn"
                          aria-label={`${set.warnings.length} ${set.warnings.length === 1 ? 'warning' : 'warnings'}: ${warningLabel}`}
                          title={warningLabel}
                        >
                          <WarnIcon />
                          <span className="mr-num" aria-hidden="true">
                            {set.warnings.length}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openRow && (
        <PricingDrawer
          key={openRow.variantId}
          row={openRow}
          fulfillmentMinor={fulfillmentMinor}
          onClose={closeDrawer}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
