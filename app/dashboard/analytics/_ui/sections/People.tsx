'use client';

import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { cairoDateTime, egp, fmtInt } from '@/lib/analytics/format';
import { nextSort } from '@/lib/analytics/sort';
import { visiblePeople, type PeopleSortKey } from '@/lib/analytics/view-state';
import type { PersonView } from '@/lib/analytics/model';
import { useShell } from '../context';
import { Panel, SearchBox, SortTh, SourcePill, Tag } from '../parts';

function Outcome({ p }: { p: PersonView }) {
  if (p.orders > 0) return <Tag tone="ok">Bought · {egp(p.revenueMinor)}</Tag>;
  if (p.cartMinor > 0)
    return (
      <Tag tone="warn" icon={ShoppingBag}>
        {p.outcomeLabel} · {egp(p.cartMinor)}
      </Tag>
    );
  if (p.outcome === 'bounced') return <Tag tone="muted">{p.outcomeLabel}</Tag>;
  return <span>{p.outcomeLabel}</span>;
}

const COLS: { k: PeopleSortKey; label: string; left?: boolean }[] = [
  { k: 'id', label: 'Visitor' },
  { k: 'source', label: 'Came from', left: true },
  { k: 'place', label: 'Location', left: true },
  { k: 'device', label: 'Device', left: true },
  { k: 'sessions', label: 'Visits' },
  { k: 'pages', label: 'Pages' },
  { k: 'outcome', label: 'Outcome', left: true },
  { k: 'last', label: 'Last seen' },
];

export default function People() {
  const { model, view, setView, openVisitor } = useShell();
  const rows = visiblePeople(model.people, view.peopleQuery, view.peopleSort);
  const q = view.peopleQuery;
  return (
    <Panel
      id="anx-people"
      title="People"
      meta={
        <span role="status">
          {q ? `${fmtInt(rows.length)} of ${fmtInt(model.people.length)} counted visitors match` : `${fmtInt(model.people.length)} counted visitors · most recent first`}
        </span>
      }
      tools={<SearchBox id="anx-pq" label="Search people" value={q} onChange={(v) => setView({ peopleQuery: v })} placeholder="Visitor #, source, city, product" />}
    >
      <div className="anx-tw anx-cards anx-sticky-first" style={{ maxHeight: 640 }}>
        <table className="anx-table">
          <thead>
            <tr>
              {COLS.map((c) => (
                <SortTh
                  key={c.k}
                  k={c.k}
                  label={c.label}
                  left={c.left}
                  sort={view.peopleSort}
                  onSort={(k) => setView({ peopleSort: nextSort(view.peopleSort, k, k === 'id' || k === 'source' || k === 'place' || k === 'device' || k === 'outcome' ? 'asc' : 'desc') })}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((p) => (
                <tr
                  key={p.id}
                  className="anx-clickable"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    openVisitor(p.id);
                  }}
                >
                  <td>
                    <button type="button" className="anx-link" onClick={() => openVisitor(p.id)}>
                      {p.label}
                    </button>
                  </td>
                  <td data-l="Came from" className="anx-tl">
                    <SourcePill platform={p.platform} label={p.source} warn={p.channel === 'paid' && p.campaignState !== 'named'} />
                  </td>
                  <td data-l="Location" className="anx-tl">
                    {p.place}
                  </td>
                  <td data-l="Device" className="anx-tl">
                    {p.device}
                  </td>
                  <td data-l="Visits">{p.sessions == null ? <span className="anx-small">—</span> : fmtInt(p.sessions)}</td>
                  <td data-l="Pages">{p.pages == null ? <span className="anx-small">—</span> : fmtInt(p.pages)}</td>
                  <td data-l="Outcome" className="anx-tl">
                    <Outcome p={p} />
                  </td>
                  <td data-l="Last seen">{cairoDateTime(p.lastSeenAt)}</td>
                </tr>
              ))
            ) : (
              <tr className="anx-empty-row">
                <td colSpan={8}>
                  {q ? (
                    <>
                      <b>No one matches “{q}”.</b> Search by visitor number (“1187”), source (“instagram”), city (“Giza”) or product.{' '}
                      <button type="button" className="anx-link" onClick={() => setView({ peopleQuery: '' })}>
                        Clear search
                      </button>
                    </>
                  ) : (
                    'No counted visitors in this range.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="anx-panel-b" style={{ borderTop: '1px solid var(--anx-hair)' }}>
        <span className="anx-field-hint">Visits and pages are each person’s all-time totals. Open anyone for their full journey.</span>
      </div>
    </Panel>
  );
}
