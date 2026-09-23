'use client';

import React, { useState } from 'react';
import { AlertTriangle, ChevronRight, Check, UserX } from 'lucide-react';
import { CHANNELS } from '@/lib/analytics/source';
import { egp, fmtInt, fmtPct, cairoDateTime, dayLabel } from '@/lib/analytics/format';
import { isSteepDrop } from '@/lib/analytics/funnel';
import type { NextStep } from '@/lib/analytics/model';
import { useShell, useStored, writeStored } from '../context';
import { Dot, InfoTip, Panel, RowToggle, StatusChip, Tag, Zero } from '../parts';
import TrendChart from '../TrendChart';

const STEPS_KEY = 'mr-analytics-next-steps';
const SNOOZE_MS = 7 * 24 * 3600 * 1000;
type StepMark = { state: 'done' | 'snoozed'; at: number };

function readMarks(raw: string | null): Record<string, StepMark> {
  try {
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function Ledger() {
  const { model } = useShell();
  const top = model.counts.visited;
  return (
    <section className="anx-ledger" aria-label="Funnel, unique people">
      {model.steps.map((s, i) => {
        const leak = i === model.leak;
        return (
          <div key={s.key} className="anx-stage" data-leak={leak || undefined}>
            <div className="anx-stage-l">
              {s.label}
              <InfoTip def={s.def} label={`What counts as ${s.label}`} side="bottom" />
            </div>
            <div className="anx-stage-n anx-num">{fmtInt(s.n)}</div>
            <div className="anx-stage-s">
              {s.prev != null ? (
                <>
                  <b>{fmtPct(s.n, s.prev)}</b> of previous step
                </>
              ) : (
                'unique people'
              )}
            </div>
            <div className="anx-bar" aria-hidden>
              <i style={{ transform: `scaleX(${top ? s.n / top : 0})` }} />
            </div>
            {leak ? (
              <span className="anx-leak-tag">
                <AlertTriangle aria-hidden />
                Biggest drop · −{fmtInt(s.lost)}
              </span>
            ) : null}
            {i < model.steps.length - 1 ? (
              <span className="anx-arrow" aria-hidden>
                <ChevronRight />
              </span>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

const SEVERITY: Record<NextStep['severity'], { label: string; status: 'bad' | 'warn' | 'unk' }> = {
  high: { label: 'Highest', status: 'bad' },
  warn: { label: 'Needs attention', status: 'warn' },
  info: { label: 'For awareness', status: 'unk' },
};

function NextSteps() {
  const { model, go, toast } = useShell();
  const raw = useStored(STEPS_KEY);
  const marks = readMarks(raw);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const hidden = (id: string) => {
    const m = marks[id];
    return !!m && (m.state === 'done' || now - m.at < SNOOZE_MS);
  };
  const open = model.todo.filter((s) => !hidden(s.id));
  const done = model.todo.length - open.length;
  const mark = (id: string, state: StepMark['state']) => {
    setLeaving(id);
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(
      () => {
        writeStored(STEPS_KEY, JSON.stringify({ ...marks, [id]: { state, at: Date.now() } }));
        setLeaving(null);
      },
      reduce ? 0 : 200,
    );
    toast(state === 'done' ? 'Marked done' : 'Snoozed for 7 days');
  };
  return (
    <Panel
      id="anx-next"
      title="What to do next"
      meta={`${open.length} open · ranked by what each is costing you`}
      tools={
        done ? (
          <button type="button" className="anx-linkbtn" onClick={() => writeStored(STEPS_KEY, '{}')}>
            Show {done} done or snoozed
          </button>
        ) : null
      }
    >
      <ol className="anx-steps">
        {open.length ? (
          open.map((s, i) => (
            <li key={s.id} className="anx-nx" data-leaving={leaving === s.id || undefined}>
              <span className="anx-nx-r anx-num">{i + 1}</span>
              <StatusChip status={SEVERITY[s.severity].status} label={SEVERITY[s.severity].label} />
              <span className="anx-nx-t">
                <b>{s.title}</b> {s.detail}
              </span>
              <span className="anx-nx-a">
                <button
                  type="button"
                  className="anx-link"
                  onClick={() => {
                    go(s.go, { filters: s.filters, search: s.search, visitorId: s.visitorId });
                    toast('Showing the evidence');
                  }}
                >
                  See the evidence
                </button>
                <button type="button" className="anx-btn" onClick={() => mark(s.id, 'snoozed')}>
                  Snooze
                </button>
                <button type="button" className="anx-btn anx-btn-primary" onClick={() => mark(s.id, 'done')}>
                  <Check className="anx-i-sm" aria-hidden />
                  Done
                </button>
              </span>
            </li>
          ))
        ) : (
          <li className="anx-nx">
            <span className="anx-nx-t" style={{ gridColumn: '1 / -1' }}>
              Nothing left to do for this range. New steps appear when the numbers change.
            </span>
          </li>
        )}
      </ol>
    </Panel>
  );
}

function SourcesTable() {
  const { model } = useShell();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const total = model.counts;
  const max = Math.max(1, ...model.channels.map((c) => c.visited));
  const cells = (x: { product: number; bag: number; checkout: number; purchased: number }) => (
    <>
      <td data-l="Viewed product">
        <Zero n={x.product} />
      </td>
      <td data-l="Bag">
        <Zero n={x.bag} />
      </td>
      <td data-l="Checkout">
        <Zero n={x.checkout} />
      </td>
      <td data-l="Purchased">
        <Zero n={x.purchased} />
      </td>
      <td data-l="View → bag" className={isSteepDrop(x.product, x.bag) ? 'anx-drop' : 'anx-pct'}>
        {fmtPct(x.bag, x.product)}
      </td>
    </>
  );
  return (
    <Panel id="anx-src" title="Where visitors came from" meta="Unique people · open a source for its campaigns">
      <div className="anx-panel-b" style={{ borderBottom: '1px solid var(--anx-hair)' }}>
        <div className="anx-split" role="img" aria-label={model.channels.map((c) => `${c.label} ${c.visited}`).join(', ')}>
          {model.channels.map((c) => (
            <i key={c.key} style={{ flex: c.visited, background: CHANNELS[c.channel].color }} />
          ))}
        </div>
        <div className="anx-legend">
          {model.channels.map((c) => (
            <span key={c.key}>
              <Dot color={CHANNELS[c.channel].color} />
              {c.label} <b className="anx-num">{fmtInt(c.visited)}</b> <small className="anx-num">{fmtPct(c.visited, total.visited)}</small>
            </span>
          ))}
        </div>
      </div>
      <div className="anx-tw anx-cards anx-sticky-first">
        <table className="anx-table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Visitors</th>
              <th scope="col">Viewed product</th>
              <th scope="col">Bag</th>
              <th scope="col">Checkout</th>
              <th scope="col">Purchased</th>
              <th scope="col">View → bag</th>
            </tr>
          </thead>
          <tbody>
            {model.channels.map((c) => (
              <React.Fragment key={c.key}>
                <tr>
                  <td>
                    <span className="anx-name">
                      {c.campaigns.length > 1 ? (
                        <RowToggle open={!!open[c.key]} label={`Show campaigns in ${c.label}`} onToggle={() => setOpen((o) => ({ ...o, [c.key]: !o[c.key] }))} />
                      ) : null}
                      <Dot color={CHANNELS[c.channel].color} />
                      {c.label}
                    </span>
                  </td>
                  <td data-l="Visitors">
                    <span className="anx-name" style={{ justifyContent: 'flex-end' }}>
                      <i aria-hidden style={{ display: 'inline-block', height: 6, borderRadius: 2, width: Math.max(2, Math.round((c.visited / max) * 64)), background: CHANNELS[c.channel].color, opacity: 0.55 }} />
                      {fmtInt(c.visited)}
                    </span>
                  </td>
                  {cells(c)}
                </tr>
                {open[c.key]
                  ? c.campaigns.map((k) => (
                      <tr key={k.key} className="anx-child">
                        <td>
                          <span className="anx-name">
                            {k.label}
                            {k.flag ? (
                              <Tag tone="warn" icon={AlertTriangle}>
                                {k.flag}
                              </Tag>
                            ) : null}
                          </span>
                        </td>
                        <td data-l="Visitors">{fmtInt(k.visited)}</td>
                        {cells(k)}
                      </tr>
                    ))
                  : null}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>
                <b>Total</b>
              </td>
              <td data-l="Visitors">
                <b>{fmtInt(total.visited)}</b>
              </td>
              <td data-l="Viewed product">
                <b>{fmtInt(total.product)}</b>
              </td>
              <td data-l="Bag">
                <b>{fmtInt(total.bag)}</b>
              </td>
              <td data-l="Checkout">
                <b>{fmtInt(total.checkout)}</b>
              </td>
              <td data-l="Purchased">
                <b>{fmtInt(total.purchased)}</b>
              </td>
              <td data-l="View → bag" className="anx-pct">
                {fmtPct(total.bag, total.product)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

function Landings() {
  const { model } = useShell();
  return (
    <Panel id="anx-land" title="Where they landed" meta="Clean paths · click ids removed">
      <div className="anx-tw anx-cards">
        <table className="anx-table">
          <thead>
            <tr>
              <th scope="col">Landing page</th>
              <th scope="col">Visitors</th>
              <th scope="col">Viewed product</th>
              <th scope="col">Bag</th>
            </tr>
          </thead>
          <tbody>
            {model.landings.map((l) => (
              <tr key={l.key}>
                <td style={{ whiteSpace: 'normal', minWidth: 160 }}>
                  <span className="anx-name">
                    {l.label}
                    {l.unknown ? <Tag tone="muted">unknown</Tag> : null}
                  </span>
                </td>
                <td data-l="Visitors">{fmtInt(l.visited)}</td>
                <td data-l="Viewed product">
                  <Zero n={l.product} />
                </td>
                <td data-l="Bag">
                  <Zero n={l.bag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Carts() {
  const { model, openVisitor } = useShell();
  return (
    <Panel id="anx-carts" title="Open carts" meta={model.carts.length ? `${egp(model.cartsValueMinor)} waiting` : 'Nothing waiting'}>
      <div className="anx-panel-b anx-list">
        {model.carts.length ? (
          model.carts.map((c) => (
            <div className="anx-li" key={c.key}>
              {c.visitorId ? (
                <button type="button" className="anx-link anx-li-t" onClick={() => openVisitor(c.visitorId!)}>
                  {c.label}
                </button>
              ) : (
                <b className="anx-li-t">{c.label}</b>
              )}
              <b className="anx-num">{egp(c.valueMinor)}</b>
              <div className="anx-li-s">
                {c.products[0] ? <span>{c.products[0]}</span> : <span>{c.items} {c.items === 1 ? 'item' : 'items'}</span>}
                <span>· {c.source}</span>
                <span>· {c.stage}</span>
                <span>· {cairoDateTime(c.lastSeenAt)}</span>
                {c.contactable ? (
                  <Tag tone="ok">Can be contacted</Tag>
                ) : (
                  <Tag tone="muted" icon={UserX}>
                    No contact
                  </Tag>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="anx-p">No open carts {model.filtered ? 'from these filters' : 'in this range'}.</p>
        )}
      </div>
    </Panel>
  );
}

function Products() {
  const { model } = useShell();
  return (
    <Panel id="anx-prod" title="Products people looked at" meta="Viewers are people; Added counts add-to-bag events">
      <div className="anx-tw anx-cards">
        <table className="anx-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">
                <span className="anx-name" style={{ justifyContent: 'flex-end' }}>
                  Viewers
                  <InfoTip def="viewed" label="What counts as a viewer" />
                </span>
              </th>
              <th scope="col">
                <span className="anx-name" style={{ justifyContent: 'flex-end' }}>
                  Added
                  <InfoTip def="addToCartEvents" label="What add-to-bag events are" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {model.products.length ? (
              model.products.slice(0, 12).map((p) => (
                <tr key={p.name}>
                  <td style={{ whiteSpace: 'normal', minWidth: 140 }}>{p.name}</td>
                  <td data-l="Viewers">{fmtInt(p.viewers)}</td>
                  <td data-l="Added (events)">{p.addToCartEvents == null ? <span className="anx-small">loading</span> : <Zero n={p.addToCartEvents} />}</td>
                </tr>
              ))
            ) : (
              <tr className="anx-empty-row">
                <td colSpan={3}>Nobody opened a product in this range.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function Overview() {
  const { model } = useShell();
  const peak = model.daily.reduce((b, d) => (d.visitors > b.visitors ? d : b), { day: '', visitors: -1 });
  return (
    <>
      <Ledger />
      <NextSteps />
      <div className="anx-grid-2">
        <div className="anx-stack">
          <SourcesTable />
          <Landings />
        </div>
        <div className="anx-stack">
          <Panel
            id="anx-trend"
            title="Visitors per day"
            meta={peak.visitors > 0 ? `Daily count · peak ${fmtInt(peak.visitors)} on ${dayLabel(peak.day)}` : 'Daily count'}
          >
            <div className="anx-panel-b">
              <TrendChart data={model.daily} />
              {model.filtered ? <p className="anx-field-hint">The daily count covers all counted traffic; filters don’t narrow it yet.</p> : null}
            </div>
          </Panel>
          <Carts />
          <Products />
        </div>
      </div>
    </>
  );
}
