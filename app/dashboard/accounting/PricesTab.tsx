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
import { MenuSelect } from '@/components/dashboard/AnimatedControls';
import DashboardActionBar from '@/components/dashboard/DashboardActionBar';
import { getGroundPrices, groundItemKey, undoGroundPrices, type GroundPrices, type GroundPriceItem } from '@/lib/api/ground-pricing';
import GroundPriceEditor from './GroundPriceEditor';
import DownScrollHeader from './DownScrollHeader';

function formatMargin(bp: number): string {
  const pct = Math.round(bp / 10) / 10;
  return pct < 0 ? `−${Math.abs(pct).toFixed(1)}%` : `${pct.toFixed(1)}%`;
}

const PAGE_SIZES = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];
type ModeFilter = 'ALL' | 'SYSTEM' | 'MANUAL';
type FlagFilter = 'ALL' | 'FLAGGED' | 'CLEAR';
type SortField = 'ITEM' | 'MODE' | 'COST' | 'MARKET' | 'FLOOR' | 'PRICE' | 'MARGIN' | 'PROFIT' | 'FLAGS' | 'GROUND' | 'GROUNDMARGIN';
type SortValue = 'DEFAULT' | `${SortField}_${'ASC' | 'DESC'}`;

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
  'ITEM_ASC', 'ITEM_DESC', 'MODE_ASC', 'MODE_DESC', 'MARKET_ASC', 'MARKET_DESC',
  'FLOOR_ASC', 'FLOOR_DESC', 'FLAGS_ASC', 'FLAGS_DESC', 'GROUND_ASC', 'GROUND_DESC',
  'GROUNDMARGIN_ASC', 'GROUNDMARGIN_DESC',
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
  const [ground, setGround] = useState<GroundPrices | null>(null);
  const [groundError, setGroundError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [groundEditor, setGroundEditor] = useState<GroundPriceItem | 'bulk' | null>(null);
  const [undoRun, setUndoRun] = useState<string | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const loadGround = useCallback(async () => {
    try { setGround(await getGroundPrices()); setGroundError(''); }
    catch { setGroundError('Ground prices could not load. Online prices are still available.'); }
  }, []);
  useEffect(() => {
    let active = true;
    getGroundPrices().then(result => { if (active) setGround(result); }).catch(() => { if (active) setGroundError('Ground prices could not load. Online prices are still available.'); });
    return () => { active = false; };
  }, []);
  const groundByKey = useMemo(() => new Map(ground?.items.map(item => [groundItemKey(item), item]) ?? []), [ground]);
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
    await loadGround();
  }, [loadGround]);

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
      <th scope="col" className={field === 'ITEM' || field === 'MODE' ? undefined : 'acct-num'} aria-sort={ariaSortFor(sort, field)}>
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
        name: row.productName, key: `VARIANT:${row.variantId}`,
        market: row.system.marketMinor, floor: row.system.floors?.noLossShownMinor ?? null,
        flags: row.system.flags.length,
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
        name: row.name, key: `BUNDLE:${row.bundleId}`,
        market: null, floor: row.system?.floors?.noLossShownMinor ?? null,
        flags: row.warnings.length,
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
    const value = (item: (typeof next)[number]): string | number | null => {
      if (field === 'ITEM') return item.name;
      if (field === 'MODE') return item.mode;
      if (field === 'MARKET') return item.market;
      if (field === 'FLOOR') return item.floor;
      if (field === 'FLAGS') return item.flags;
      if (field === 'GROUND') return groundByKey.get(item.key)?.groundPriceMinor ?? null;
      if (field === 'GROUNDMARGIN') return groundByKey.get(item.key)?.marginBp ?? null;
      return field === 'COST' ? item.cost : field === 'MARGIN' ? item.margin : field === 'PRICE' ? item.price : item.profit;
    };
    return next.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      const result = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av) - Number(bv);
      return direction === 'ASC' ? result : -result;
    });
  }, [allRows, flagFilter, modeFilter, sort, debouncedSearch, groundByKey]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageKeys = pagedRows.map(item => item.key).filter(key => groundByKey.has(key));
  const toggleSelected = (key: string) => setSelected(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]);
  const priceHeader = <tr>
    <th scope="col"><input type="checkbox" aria-label="Select this page for Ground pricing" checked={pageKeys.length > 0 && pageKeys.every(key => selected.includes(key))} disabled={!pageKeys.length} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, ...pageKeys])] : current.filter(key => !pageKeys.includes(key)))} /></th>
    {sortHeader('ITEM', 'Item')}{sortHeader('MODE', 'Mode')}{sortHeader('COST', 'Cost')}
    {sortHeader('MARKET', 'Market')}{sortHeader('FLOOR', 'Law 1 / no-loss floor')}
    {sortHeader('PRICE', 'Price')}{sortHeader('MARGIN', 'Margin')}{sortHeader('PROFIT', 'Profit')}
    {sortHeader('FLAGS', 'Flags')}{sortHeader('GROUND', 'Ground price')}{sortHeader('GROUNDMARGIN', 'Ground margin')}
    <th scope="col">Edit</th>
  </tr>;
  const groundCells = (key: string) => {
    const item = groundByKey.get(key);
    return <>
      <td data-label="Ground price" className="acct-num acct-ground-cell">{item ? <><strong>{formatEgpMinor(item.groundPriceMinor)}</strong><span className="acct-prices-sub">{item.mode === 'SYSTEM' ? 'Linked to online' : 'My Ground price'}</span><span className="acct-prices-sub">Current online: {formatEgpMinor(item.onlinePriceMinor)}</span></> : <span>{groundError ? 'Unavailable' : 'Loading…'}</span>}</td>
      <td data-label="Ground margin" className="acct-num acct-ground-cell">{item?.marginBp != null ? formatMargin(item.marginBp) : '—'}</td>
      <td data-label="Edit"><div className="acct-price-actions">{key.startsWith('VARIANT:') ? <button type="button" className="dash-btn-secondary" onClick={event => {event.stopPropagation();setOpenId(key.slice(8));}}>Edit online</button> : <Link className="dash-btn-secondary" href={`/catalogue/bundles/${key.slice(7)}/edit`}>Edit online</Link>}<button type="button" className="dash-btn-secondary" disabled={!item} onClick={event => { event.stopPropagation(); if (item) setGroundEditor(item); }}>Edit Ground</button></div></td>
    </>;
  };

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

      {groundError && <div className="acct-ground-notice" role="alert">{groundError} <button type="button" className="dash-btn-secondary" onClick={() => void loadGround()}>Retry Ground prices</button></div>}
      {ground && <div className="acct-ground-notice"><div><strong>Ground System prices stay linked</strong><p>Default: {ground.rule.type === 'PERCENT' ? `${ground.rule.value / 100}%` : formatEgpMinor(ground.rule.value)} above the current online selling price, including automatic offers. The Price column shows the online list price. Ground margin uses bought cost only.</p></div><button type="button" className="dash-btn-secondary" onClick={() => setGroundEditor('bulk')}>Edit Ground rule</button></div>}

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
        <MenuSelect label="Mode" value={modeFilter} options={[{value:'ALL',label:'All modes'},{value:'SYSTEM',label:'System price'},{value:'MANUAL',label:'My price'}]} onChange={value => { setModeFilter(value); setPage(1); updateUrl({ mode: value === 'ALL' ? null : value, page: null }); }} />
        <MenuSelect label="Flags" value={flagFilter} options={[{value:'ALL',label:'All items'},{value:'FLAGGED',label:'Needs attention'},{value:'CLEAR',label:'No flags'}]} onChange={value => { setFlagFilter(value); setPage(1); updateUrl({ flags: value === 'ALL' ? null : value, page: null }); }} />
        <MenuSelect label="Sort" value={sort} options={SORT_VALUES.map(value => ({value,label:value === 'DEFAULT' ? 'Catalogue order' : value.replace('GROUNDMARGIN','Ground margin').replace('_ASC',': lowest first').replace('_DESC',': highest first')}))} onChange={value => { setSort(value); setPage(1); updateUrl({ sort: value === 'DEFAULT' ? null : value, page: null }); }} />
        <MenuSelect label="Rows per page" value={String(pageSize)} options={PAGE_SIZES.map(size => ({value:String(size),label:String(size)}))} onChange={raw => { const value = pageSizeFrom(raw); setPageSize(value); setPage(1); updateUrl({ size: value === 20 ? null : String(value), page: null }); }} />
      </div>

      {items.length === 0 && sets.length === 0 ? (
        <p className="acct-prices-empty">No house products yet. Items you add to the catalogue appear here.</p>
      ) : (
        <div className="dash-table-wrap">
          <table ref={tableRef} className="dash-table acct-prices-table" aria-label="Prices">
            <thead>{priceHeader}</thead>
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
                    <td data-label="Select" onClick={event => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${row.productName} for Ground pricing`} disabled={!groundByKey.has(item.key)} checked={selected.includes(item.key)} onChange={() => toggleSelected(item.key)} /></td>
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
                    {groundCells(item.key)}
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
                    <td data-label="Select"><input type="checkbox" aria-label={`Select ${set.name} for Ground pricing`} disabled={!groundByKey.has(item.key)} checked={selected.includes(item.key)} onChange={() => toggleSelected(item.key)} /></td>
                    <td data-label="Item" className="acct-prices-item">
                      <Link href={`/catalogue/bundles/${set.bundleId}/edit`} className="acct-prices-item-layout">
                        <ProductThumb src={coverByProduct[set.members[0]?.productId]} />
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
                    {groundCells(item.key)}
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

      <DownScrollHeader tableRef={tableRef}>{priceHeader}</DownScrollHeader>
      <DashboardActionBar title={selected.length ? `${selected.length} selected` : 'Accounting'} description="Ground prices track online prices">
        {selected.length > 0 && <button className="dash-btn-secondary" type="button" onClick={() => setSelected([])}>Clear selection</button>}
        {undoRun && <button className="dash-btn-secondary" type="button" disabled={undoBusy} onClick={async () => { setUndoBusy(true); try { setGround(await undoGroundPrices(undoRun)); setUndoRun(null); setGroundError(''); } catch (error) { setGroundError(error instanceof Error ? error.message : 'Could not undo. Reload prices and try again.'); } finally { setUndoBusy(false); } }}>{undoBusy ? 'Undoing…' : 'Undo Ground change'}</button>}
        <button type="button" className="dash-btn-primary" disabled={!ground} onClick={() => setGroundEditor('bulk')}>Bulk edit Ground</button>
      </DashboardActionBar>
      {ground && groundEditor && <GroundPriceEditor overview={ground} item={groundEditor === 'bulk' ? undefined : groundEditor} selected={selected} onClose={() => setGroundEditor(null)} onSaved={(result) => { setGround(result); setUndoRun(result.runId); setGroundError(''); setGroundEditor(null); }} />}

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
