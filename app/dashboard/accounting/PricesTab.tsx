'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { floorBreach } from '@/app/dashboard/bundles/bundle-economics';
import { formatEgpMinor } from '@/components/dashboard/charts';
import RetryingImage from '@/components/dashboard/RetryingImage';
import { apiAccountingOverview, type AccountingOverview, type PriceFlag } from '@/lib/api/accounting';
import { listProducts } from '@/lib/catalog/api';
import PricingDrawer, { FLAG_LABELS, MODE, formatSignedEgp } from './PricingDrawer';
import './prices-tab.css';

function formatMargin(bp: number): string {
  const pct = Math.round(bp / 10) / 10;
  return pct < 0 ? `−${Math.abs(pct).toFixed(1)}%` : `${pct.toFixed(1)}%`;
}

const PAGE_SIZES = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];
type ModeFilter = 'ALL' | 'SYSTEM' | 'MANUAL';
type FlagFilter = 'ALL' | 'FLAGGED' | 'CLEAR';
type SortField = 'COST' | 'PRICE' | 'MARGIN' | 'PROFIT';
type SortValue =
  | 'DEFAULT'
  | 'COST_DESC'
  | 'COST_ASC'
  | 'MARGIN_DESC'
  | 'MARGIN_ASC'
  | 'PRICE_DESC'
  | 'PRICE_ASC'
  | 'PROFIT_DESC'
  | 'PROFIT_ASC';

const SORT_VALUES: readonly SortValue[] = [
  'DEFAULT',
  'COST_DESC',
  'COST_ASC',
  'MARGIN_DESC',
  'MARGIN_ASC',
  'PRICE_DESC',
  'PRICE_ASC',
  'PROFIT_DESC',
  'PROFIT_ASC',
] as const;

/** desc -> asc -> default, matching the header's own column each time. */
function nextSort(current: SortValue, field: SortField): SortValue {
  const desc = `${field}_DESC` as SortValue;
  const asc = `${field}_ASC` as SortValue;
  if (current === desc) return asc;
  if (current === asc) return 'DEFAULT';
  return desc;
}

function ariaSortFor(current: SortValue, field: SortField): 'ascending' | 'descending' | 'none' {
  if (current === `${field}_DESC`) return 'descending';
  if (current === `${field}_ASC`) return 'ascending';
  return 'none';
}

function pageSizeFrom(raw: string | null): PageSize {
  const size = Number(raw);
  return PAGE_SIZES.includes(size as PageSize) ? (size as PageSize) : 20;
}

function positivePage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function enumFrom<T extends string>(raw: string | null, values: readonly T[], fallback: T): T {
  return raw && values.includes(raw as T) ? (raw as T) : fallback;
}

function ProductThumb({ src }: { src?: string | null }) {
  const fallback = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="m7 16 3.4-3.4a2 2 0 0 1 2.8 0L17 16" />
      <circle cx="15.5" cy="8.5" r="1.5" />
    </svg>
  );
  return src ? (
    <RetryingImage src={src} alt="" className="acct-prices-thumb" fallback={fallback} />
  ) : (
    <span className="acct-prices-thumb acct-prices-thumb-empty" aria-hidden="true">
      {fallback}
    </span>
  );
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

/** Sort direction glyph for a clickable column header (#98). */
function SortIcon({ direction }: { direction: 'ascending' | 'descending' | 'none' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="acct-prices-sort-icon"
      data-direction={direction}
    >
      {direction === 'ascending' ? (
        <path d="M7 14 12 9 17 14" />
      ) : direction === 'descending' ? (
        <path d="M7 10 12 15 17 10" />
      ) : (
        <>
          <path d="M7 10 12 6 17 10" />
          <path d="M7 14 12 18 17 14" />
        </>
      )}
    </svg>
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
  const [coverByProduct, setCoverByProduct] = useState<Record<string, string | null>>({});
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [highlightSetId, setHighlightSetId] = useState<string | null>(null);
  const [linkParamsApplied, setLinkParamsApplied] = useState(false);
  const [page, setPage] = useState(() => positivePage(params.get('page')));
  const [pageSize, setPageSize] = useState<PageSize>(() => pageSizeFrom(params.get('size')));
  const [modeFilter, setModeFilter] = useState<ModeFilter>(() =>
    enumFrom(params.get('mode'), ['ALL', 'SYSTEM', 'MANUAL'] as const, 'ALL'),
  );
  const [flagFilter, setFlagFilter] = useState<FlagFilter>(() =>
    enumFrom(params.get('flags'), ['ALL', 'FLAGGED', 'CLEAR'] as const, 'ALL'),
  );
  const [sort, setSort] = useState<SortValue>(() => enumFrom(params.get('sort'), SORT_VALUES, 'DEFAULT'));
  const [search, setSearch] = useState(() => params.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const setRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const queryRef = useRef(params.toString());

  useEffect(() => {
    queryRef.current = params.toString();
  }, [params]);


  const load = useCallback(() => {
    let cancelled = false;
    Promise.allSettled([apiAccountingOverview(), listProducts({ page: 1, limit: 100, space: 'house' })])
      .then(([overviewResult, catalogueResult]) => {
        if (cancelled) return;
        if (overviewResult.status === 'rejected') {
          setError(true);
          return;
        }
        setOverview(overviewResult.value);
        if (catalogueResult.status === 'fulfilled') {
          setCoverByProduct(
            Object.fromEntries(catalogueResult.value.items.map((product) => [product.id, product.coverUrl])),
          );
        }
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

  const items = useMemo(() => overview?.variants ?? [], [overview]);
  /** Sets (backend#166) list below the variants and open in the bundle editor. */
  const sets = useMemo(() => overview?.sets ?? [], [overview]);
  const fulfillmentMinor = overview?.fees.fulfillmentMinor ?? 0;
  const openRow = items.find((r) => r.variantId === openId) ?? null;
  const withFlags = items.filter((r) => r.system.flags.length > 0).length;

  const updateUrl = useCallback(
    (changes: Record<string, string | null>) => {
      const qs = new URLSearchParams(queryRef.current);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) qs.delete(key);
        else qs.set(key, value);
      }
      const query = qs.toString();
      queryRef.current = query;
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const applySort = useCallback(
    (field: SortField) => {
      const value = nextSort(sort, field);
      setSort(value);
      setPage(1);
      updateUrl({ sort: value === 'DEFAULT' ? null : value, page: null });
    },
    [sort, updateUrl],
  );

  const sortHeader = useCallback(
    (field: SortField, label: string) => (
      <th scope="col" className="acct-num" aria-sort={ariaSortFor(sort, field)}>
        <button type="button" className="acct-prices-sort-btn" onClick={() => applySort(field)}>
          {label}
          <SortIcon direction={ariaSortFor(sort, field)} />
        </button>
      </th>
    ),
    [sort, applySort],
  );

  // 300ms so typing a product name is one filter pass, not one per keystroke.
  // The URL and page reset land in the same timeout callback (not the effect
  // body) so a settled search never leaves a stale `page` param behind.
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = search.trim();
      setDebouncedSearch(trimmed);
      if (trimmed !== (params.get('q') ?? '')) {
        setPage(1);
        updateUrl({ q: trimmed || null, page: null });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, params, updateUrl]);

  const allRows = useMemo(
    () => [
      ...items.map((row) => ({
        kind: 'variant' as const,
        row,
        mode: row.mode,
        flagged: row.system.flags.length > 0,
        cost: row.costMinor,
        margin: row.current.marginBp,
        price: row.currentPriceMinor,
        profit: row.current.productProfitMinor,
        searchText: `${row.productName} ${row.sku}`.toLowerCase(),
      })),
      ...sets.map((row) => ({
        kind: 'set' as const,
        row,
        mode: row.mode,
        flagged: row.warnings.length > 0,
        cost: row.costMinor,
        margin: row.current.marginBp,
        price: row.currentPriceMinor,
        profit: row.current.productProfitMinor,
        searchText: row.name.toLowerCase(),
      })),
    ],
    [items, sets],
  );

  const filteredRows = useMemo(() => {
    const needle = debouncedSearch.toLowerCase();
    const next = allRows.filter(
      (item) =>
        (modeFilter === 'ALL' || item.mode === modeFilter) &&
        (flagFilter === 'ALL' || (flagFilter === 'FLAGGED' ? item.flagged : !item.flagged)) &&
        (!needle || item.searchText.includes(needle)),
    );
    if (sort === 'DEFAULT') return next;
    const [field, direction] = sort.split('_') as [SortField, 'ASC' | 'DESC'];
    const value = (item: (typeof next)[number]) =>
      field === 'COST' ? item.cost : field === 'MARGIN' ? item.margin : field === 'PRICE' ? item.price : item.profit;
    return next.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      return direction === 'ASC' ? av - bv : bv - av;
    });
  }, [allRows, flagFilter, modeFilter, sort, debouncedSearch]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const changePage = useCallback(
    (next: number) => {
      setPage(next);
      updateUrl({ page: next === 1 ? null : String(next) });
    },
    [updateUrl],
  );

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
      const setIndex = filteredRows.findIndex(
        (item) => item.kind === 'set' && item.row.bundleId === openSetParam,
      );
      if (setIndex >= 0) setPage(Math.floor(setIndex / pageSize) + 1);
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

      <div className="acct-prices-tools" aria-label="Price table controls">
        <label className="acct-prices-search">
          <span>Search</span>
          <input
            type="search"
            className="dash-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Product, SKU or set name…"
            aria-label="Search prices by product, SKU or set name"
          />
        </label>
        <label>
          <span>Mode</span>
          <select
            value={modeFilter}
            onChange={(event) => {
              const value = event.target.value as ModeFilter;
              setModeFilter(value);
              setPage(1);
              updateUrl({ mode: value === 'ALL' ? null : value, page: null });
            }}
          >
            <option value="ALL">All modes</option>
            <option value="SYSTEM">System price</option>
            <option value="MANUAL">My price</option>
          </select>
        </label>
        <label>
          <span>Flags</span>
          <select
            value={flagFilter}
            onChange={(event) => {
              const value = event.target.value as FlagFilter;
              setFlagFilter(value);
              setPage(1);
              updateUrl({ flags: value === 'ALL' ? null : value, page: null });
            }}
          >
            <option value="ALL">All items</option>
            <option value="FLAGGED">Needs attention</option>
            <option value="CLEAR">No flags</option>
          </select>
        </label>
        <label className="acct-prices-sort">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(event) => {
              const value = event.target.value as SortValue;
              setSort(value);
              setPage(1);
              updateUrl({ sort: value === 'DEFAULT' ? null : value, page: null });
            }}
          >
            <option value="DEFAULT">Catalogue order</option>
            <option value="COST_DESC">Cost: highest first</option>
            <option value="COST_ASC">Cost: lowest first</option>
            <option value="PRICE_DESC">Price: highest first</option>
            <option value="PRICE_ASC">Price: lowest first</option>
            <option value="MARGIN_DESC">Margin: highest first</option>
            <option value="MARGIN_ASC">Margin: lowest first</option>
            <option value="PROFIT_DESC">Profit: highest first</option>
            <option value="PROFIT_ASC">Profit: lowest first</option>
          </select>
        </label>
        <label>
          <span>Rows</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(event) => {
              const value = pageSizeFrom(event.target.value);
              setPageSize(value);
              setPage(1);
              updateUrl({ size: value === 20 ? null : String(value), page: null });
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {items.length === 0 && sets.length === 0 ? (
        <p className="acct-prices-empty">No house products yet. Items you add to the catalogue appear here.</p>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table acct-prices-table" aria-label="Prices">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Mode</th>
                {sortHeader('COST', 'Cost')}
                <th scope="col" className="acct-num">Market</th>
                <th scope="col" className="acct-num">Law 1 / no-loss floor</th>
                {sortHeader('PRICE', 'Price')}
                {sortHeader('MARGIN', 'Margin')}
                {sortHeader('PROFIT', 'Profit')}
                <th scope="col" className="acct-num">Flags</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((item) => {
                if (item.kind === 'variant') {
                const row = item.row;
                const floors = row.system.floors;
                const market = row.system.marketMinor;
                const price = row.currentPriceMinor;
                const { marginBp, productProfitMinor } = row.current;
                const belowNoLoss = floors !== null && price < floors.noLossShownMinor;
                const belowLaw1 = floors !== null && price < floors.law1ShownMinor;
                return (
                  <tr key={row.variantId} className="acct-prices-row" onClick={() => setOpenId(row.variantId)}>
                    <td data-label="Item" className="acct-prices-item">
                      <div className="acct-prices-item-layout">
                        <ProductThumb src={coverByProduct[row.productId]} />
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
                      </div>
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
                }
                const set = item.row;
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
                      <Link href={`/catalogue/bundles/${set.bundleId}/edit`} className="acct-prices-item-layout">
                        <span className="acct-prices-thumb acct-prices-thumb-set" aria-hidden="true">Set</span>
                        <span className="acct-prices-item-copy">
                          <span className="acct-prices-name">{set.name}</span>{' '}
                          <span className="acct-prices-detail">
                            Set · {set.members.length} {set.members.length === 1 ? 'piece' : 'pieces'}
                            {set.mode === 'SYSTEM' && ` · ${formatMargin(set.effectiveSavingBp)} off`}
                            {!set.isActive && ' · Inactive'}
                          </span>
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
          {filteredRows.length === 0 ? (
            <p className="acct-prices-empty">
              {debouncedSearch ? `No item matches "${debouncedSearch}".` : 'No prices match these filters.'}
            </p>
          ) : (
            <nav className="acct-prices-pagination" aria-label="Prices pagination">
              <p>
                <span className="mr-num">{(currentPage - 1) * pageSize + 1}</span>–
                <span className="mr-num">{Math.min(currentPage * pageSize, filteredRows.length)}</span> of{' '}
                <span className="mr-num">{filteredRows.length}</span>
              </p>
              <div>
                <button
                  type="button"
                  className="dash-btn-secondary"
                  disabled={currentPage === 1}
                  onClick={() => changePage(currentPage - 1)}
                >
                  Previous
                </button>
                <span aria-current="page">
                  Page <span className="mr-num">{currentPage}</span> of <span className="mr-num">{pageCount}</span>
                </span>
                <button
                  type="button"
                  className="dash-btn-secondary"
                  disabled={currentPage === pageCount}
                  onClick={() => changePage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </nav>
          )}
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
