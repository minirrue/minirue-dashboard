'use client';

import React from 'react';
import { ShoppingBag, UserX } from 'lucide-react';
import { useVisitorStory } from '@/lib/hooks/use-analytics';
import { egp, fmtInt, fmtPct, cairoDateTime } from '@/lib/analytics/format';
import { CHANNELS } from '@/lib/analytics/source';
import type { PersonView } from '@/lib/analytics/model';
import { personHaystack } from '@/lib/analytics/view-state';
import { useShell } from '../context';
import JourneyView from '../JourneyView';
import { Dot, Panel, SearchBox, Skeleton, Tag } from '../parts';

export function PersonTags({ p }: { p: PersonView }) {
  return (
    <>
      {p.orders > 0 ? <Tag tone="ok">Bought · {egp(p.revenueMinor)}</Tag> : null}
      {p.cartMinor > 0 && p.orders === 0 ? (
        <Tag tone="warn" icon={ShoppingBag}>
          Open cart {egp(p.cartMinor)}
        </Tag>
      ) : null}
      {!p.contactable ? (
        <Tag tone="muted" icon={UserX}>
          No contact
        </Tag>
      ) : (
        <Tag tone="ok">Can be contacted</Tag>
      )}
      {!p.orders && !p.cartMinor ? <Tag tone="muted">{p.outcomeLabel}</Tag> : null}
    </>
  );
}

export function personMeta(p: PersonView): string {
  return [
    p.sessions != null ? `${fmtInt(p.sessions)} ${p.sessions === 1 ? 'visit' : 'visits'}` : null,
    p.pages != null ? `${fmtInt(p.pages)} pages` : null,
    `first seen ${cairoDateTime(p.firstSeenAt)}`,
    p.place,
    p.device.toLowerCase(),
    'identity: browser visitor ID',
  ]
    .filter(Boolean)
    .join(' · ');
}

export default function Journeys() {
  const { model, range, routes, journeyId, setJourneyId, view, setView } = useShell();
  const needle = view.journeyQuery.trim().toLowerCase();
  const list = model.people.filter((p) => !needle || personHaystack(p).some((h) => h != null && String(h).toLowerCase().includes(needle.replace(/^#/, ''))));
  const fallback = model.people.find((p) => p.cartMinor > 0 && p.orders === 0) ?? model.people[0];
  const selected = model.people.find((p) => p.id === journeyId) ?? fallback;
  const story = useVisitorStory(selected?.id, range);
  const total = model.view.length;
  return (
    <>
      <div className="anx-jgrid">
        <Panel
          as="nav"
          id="anx-jlist"
          title="Visitors"
          meta={`${fmtInt(list.length)} of ${fmtInt(model.people.length)} · most recent first`}
          tools={<SearchBox id="anx-jq" label="Search visitors" value={view.journeyQuery} onChange={(v) => setView({ journeyQuery: v })} placeholder="Visitor #, source, city" />}
        >
          <div className="anx-jl">
            {list.slice(0, 300).map((p) => (
              <button key={p.id} type="button" className="anx-jp" aria-current={selected?.id === p.id} onClick={() => setJourneyId(p.id)}>
                <span className="anx-name">
                  <Dot color={CHANNELS[p.channel].color} />
                  <b>{p.label}</b>
                </span>
                <small>
                  {p.source} · {p.outcomeLabel}
                </small>
              </button>
            ))}
            {!list.length ? <p className="anx-p" style={{ padding: 8 }}>No visitor matches.</p> : null}
            {list.length > 300 ? <p className="anx-field-hint" style={{ padding: 8 }}>Showing the 300 most recent. Search to find anyone else.</p> : null}
          </div>
        </Panel>
        <Panel
          id="anx-journey"
          title={selected ? selected.label : 'Journey'}
          meta={selected ? personMeta(selected) : 'Pick a visitor'}
          tools={
            selected ? (
              <div className="anx-tools">
                <PersonTags p={selected} />
              </div>
            ) : null
          }
        >
          <div className="anx-panel-b">
            {!selected ? (
              <p className="anx-p">No visitors in this range.</p>
            ) : story.isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skeleton h={16} w="50%" />
                <Skeleton h={64} />
                <Skeleton h={64} />
              </div>
            ) : story.isError ? (
              <p className="anx-p">This journey could not load ({story.error?.message ?? 'error'}). Try Refresh.</p>
            ) : (
              <JourneyView sessions={story.data?.sessions ?? []} routes={routes} where={`${selected.device.toLowerCase()} · ${selected.place}`} />
            )}
          </div>
        </Panel>
      </div>
      <Panel id="anx-outcomes" title="How journeys ended" meta={`${fmtInt(total)} people`}>
        <div className="anx-panel-b">
          <div className="anx-split" role="img" aria-label={model.outcomes.map((o) => `${o.label} ${o.n}`).join(', ')}>
            {model.outcomes.map((o) => (
              <i key={o.key} style={{ flex: o.n, background: o.color }} />
            ))}
          </div>
          <div className="anx-legend">
            {model.outcomes.map((o) => (
              <span key={o.key}>
                <Dot color={o.color} />
                {o.label} · <b className="anx-num">{fmtInt(o.n)}</b> <small className="anx-num">{fmtPct(o.n, total)}</small>
              </span>
            ))}
          </div>
        </div>
      </Panel>
    </>
  );
}
