'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { fmtInt, fmtPct } from '@/lib/analytics/format';
import { isSteepDrop, type StageKey } from '@/lib/analytics/funnel';
import { CHANNELS } from '@/lib/analytics/source';
import { nextSort } from '@/lib/analytics/sort';
import { visiblePaths, type PathSortKey } from '@/lib/analytics/view-state';
import type { PathRow } from '@/lib/analytics/model';
import { useShell } from '../context';
import { Dot, InfoTip, Panel, SearchBox, SortTh, Tag, ToggleGroup } from '../parts';

const COLS: { k: PathSortKey; label: string; left?: boolean }[] = [
  { k: 'source', label: 'Source' },
  { k: 'landing', label: 'Landing', left: true },
  { k: 'visited', label: 'Visited' },
  { k: 'product', label: 'Viewed product' },
  { k: 'bag', label: 'Bag' },
  { k: 'checkout', label: 'Checkout' },
  { k: 'purchased', label: 'Purchased' },
];

function StageCell({ r, k, prev, label }: { r: PathRow; k: StageKey; prev: StageKey | null; label: string }) {
  const n = r[k];
  const p = prev ? r[prev] : null;
  const drop = isSteepDrop(p, n);
  return (
    <td data-l={label} className={`${n === 0 ? 'anx-zero' : ''}${drop ? ' anx-drop' : ''}`}>
      {fmtInt(n)}
      {p ? <span className="anx-small"> {fmtPct(n, p)}</span> : null}
    </td>
  );
}

function EventsTable() {
  const { summary } = useShell();
  const rows: [string, number | undefined][] = [
    ['Page views', summary?.pageviews],
    ['Product views', summary?.productViews],
    ['Add to bag', summary?.addToCarts],
    ['Checkouts started', summary?.beginCheckouts],
    ['Purchases', summary?.purchases],
  ];
  return (
    <>
      <div className="anx-panel-b">
        <p className="anx-note">
          <Info className="anx-i" aria-hidden />
          <span>
            Events per path are not measured yet (backend#234), so this shows the range’s event totals for all counted traffic, not narrowed by filters. One person
            makes many events; switch back to People to follow paths.
          </span>
        </p>
      </div>
      <div className="anx-tw">
        <table className="anx-table">
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Events</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, n]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{n == null ? <span className="anx-small">loading</span> : fmtInt(n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Flow() {
  const { model, view, setView, openPath } = useShell();
  const rows = visiblePaths(model.paths, view.flowQuery, view.flowSort);
  const t = rows.reduce(
    (a, r) => ({ visited: a.visited + r.visited, product: a.product + r.product, bag: a.bag + r.bag, checkout: a.checkout + r.checkout, purchased: a.purchased + r.purchased }),
    { visited: 0, product: 0, bag: 0, checkout: 0, purchased: 0 },
  );
  const q = view.flowQuery;
  const imp = model.impossible;
  return (
    <Panel
      id="anx-flow"
      title="Visitor flow"
      meta="Source → landing → product → bag → checkout → purchase. Red marks a step that lost more than 90% of at least 5 people."
      tools={
        <div className="anx-tools">
          {view.flowMode === 'people' ? (
            <SearchBox id="anx-fq" label="Search paths" value={q} onChange={(v) => setView({ flowQuery: v })} placeholder="Search source, page, product" />
          ) : null}
          <ToggleGroup
            label="Count people or events"
            value={view.flowMode}
            options={[
              { value: 'people', label: 'People' },
              { value: 'events', label: 'Events' },
            ]}
            onChange={(v) => setView({ flowMode: v })}
          />
          <InfoTip def={view.flowMode === 'people' ? 'people' : 'events'} label="People or events" />
        </div>
      }
    >
      {view.flowMode === 'events' ? (
        <EventsTable />
      ) : (
        <div className="anx-tw anx-cards anx-sticky-first" style={{ maxHeight: 600 }}>
          <table className="anx-table">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <SortTh
                    key={c.k}
                    k={c.k}
                    label={c.label}
                    left={c.left}
                    sort={view.flowSort}
                    onSort={(k) => setView({ flowSort: nextSort(view.flowSort, k, k === 'source' || k === 'landing' ? 'asc' : 'desc') })}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr
                    key={r.key}
                    className="anx-clickable"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      openPath(r);
                    }}
                  >
                    <td>
                      <span className="anx-name">
                        <Dot color={CHANNELS[r.channel].color} />
                        <button type="button" className="anx-link" onClick={() => openPath(r)} aria-label={`Path detail: ${r.source} to ${r.landing}`}>
                          {r.source}
                        </button>
                        {r.flag ? <Tag tone="warn">{r.flag}</Tag> : null}
                      </span>
                    </td>
                    <td data-l="Landing" className="anx-tl">
                      {r.landing}
                    </td>
                    <StageCell r={r} k="visited" prev={null} label="Visited" />
                    <StageCell r={r} k="product" prev="visited" label="Viewed product" />
                    <StageCell r={r} k="bag" prev="product" label="Bag" />
                    <StageCell r={r} k="checkout" prev="bag" label="Checkout" />
                    <StageCell r={r} k="purchased" prev="checkout" label="Purchased" />
                  </tr>
                ))
              ) : (
                <tr className="anx-empty-row">
                  <td colSpan={7}>
                    {q ? (
                      <>
                        <b>No paths match “{q}”.</b> Try a source (“tiktok”), a product (“retinal”) or a page (“skincare”).{' '}
                        <button type="button" className="anx-link" onClick={() => setView({ flowQuery: '' })}>
                          Clear search
                        </button>
                      </>
                    ) : (
                      'No paths in this range.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length ? (
              <tfoot>
                <tr>
                  <td>
                    <b>
                      {fmtInt(rows.length)} {rows.length === 1 ? 'path' : 'paths'}
                    </b>
                  </td>
                  <td data-l="" />
                  <td data-l="Visited">
                    <b>{fmtInt(t.visited)}</b>
                  </td>
                  <td data-l="Viewed product">
                    <b>{fmtInt(t.product)}</b> <span className="anx-small">{fmtPct(t.product, t.visited)}</span>
                  </td>
                  <td data-l="Bag">
                    <b>{fmtInt(t.bag)}</b> <span className="anx-small">{fmtPct(t.bag, t.product)}</span>
                  </td>
                  <td data-l="Checkout">
                    <b>{fmtInt(t.checkout)}</b> <span className="anx-small">{fmtPct(t.checkout, t.bag)}</span>
                  </td>
                  <td data-l="Purchased">
                    <b>{fmtInt(t.purchased)}</b>
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
      <div className="anx-panel-b anx-status" style={{ borderTop: '1px solid var(--anx-hair)', paddingTop: 14, fontSize: 13 }}>
        <span data-tone={imp.orderWithoutCheckout ? 'warn' : 'ok'}>
          {imp.orderWithoutCheckout ? <AlertTriangle className="anx-i-sm" aria-hidden /> : <CheckCircle2 className="anx-i-sm" aria-hidden />}
          Order without a tracked checkout: <b>{fmtInt(imp.orderWithoutCheckout)}</b>
        </span>
        <span data-tone={imp.paidWithoutOrder ? 'warn' : 'ok'}>
          {imp.paidWithoutOrder ? <AlertTriangle className="anx-i-sm" aria-hidden /> : <CheckCircle2 className="anx-i-sm" aria-hidden />}
          Tracked payment without an order: <b>{fmtInt(imp.paidWithoutOrder)}</b>
        </span>
        <span>
          <Info className="anx-i-sm" aria-hidden />
          Checkout without a bag: <Tag tone="info">Not measured yet</Tag>
        </span>
        <span>{view.flowMode === 'events' ? 'Showing events: a person can create many.' : 'Showing unique people. Open a path for the people on it.'}</span>
      </div>
    </Panel>
  );
}
