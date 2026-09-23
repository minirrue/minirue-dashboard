'use client';

import React from 'react';
import { AlertTriangle, Ban, CheckCircle2, Info, ShoppingBag, UserX, X } from 'lucide-react';
import { PAGE_KIND_HINT, type PageKind } from '@/lib/analytics/journey';
import { CHANNELS, CHANNEL_ORDER } from '@/lib/analytics/source';
import { Dot, PagePill, SourcePill, StatusChip, Tag } from './parts';

export type LegendGroup = 'pages' | 'sources' | 'channels' | 'status' | 'numbers';

const PAGE_KINDS: PageKind[] = ['home', 'category', 'product', 'bag', 'checkout', 'page', 'unknown', 'action', 'exit'];

function Row({ k, children }: { k: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="anx-lg-row">
      <span className="anx-lg-k">{k}</span>
      <span>{children}</span>
    </div>
  );
}

const GROUPS: Record<LegendGroup, { title: string; rows: () => React.ReactNode }> = {
  pages: {
    title: 'Page visited',
    rows: () => PAGE_KINDS.map((k) => <Row key={k} k={<PagePill kind={k} />}>{PAGE_KIND_HINT[k]}</Row>),
  },
  sources: {
    title: 'Where they came from',
    rows: () => (
      <>
        <Row k={<SourcePill platform="TikTok" />}>TikTok, paid or organic</Row>
        <Row k={<SourcePill platform="Instagram" />}>Instagram (post, story, bio link, or an Instagram ad)</Row>
        <Row k={<SourcePill platform="Facebook" />}>Facebook (post, link, or a Facebook ad)</Row>
        <Row k={<SourcePill platform="Meta" />}>A Meta ad whose app (Facebook or Instagram) is unknown</Row>
        <Row k={<SourcePill platform="Google" />}>Google, search or ads</Row>
        <Row k={<SourcePill platform="Direct" />}>Typed the address or used a saved link</Row>
        <Row k={<SourcePill platform="example.com" label="Referral" />}>Another website linked to the shop</Row>
        <Row k={<SourcePill platform="TikTok" label="Campaign" warn />}>The campaign has no readable name, so it can’t be credited until fixed</Row>
      </>
    ),
  },
  channels: {
    title: 'Channel colours (tables and charts)',
    rows: () =>
      CHANNEL_ORDER.map((c) => (
        <Row
          key={c}
          k={
            <span className="anx-name">
              <Dot color={CHANNELS[c].color} />
              <b>{CHANNELS[c].label}</b>
            </span>
          }
        >
          {CHANNELS[c].hint}
        </Row>
      )),
  },
  status: {
    title: 'Labels',
    rows: () => (
      <>
        <Row k={<Tag tone="warn" icon={AlertTriangle}>Untagged</Tag>}>The ad link sends a placeholder like __CAMPAIGN_NAME__ instead of a name</Row>
        <Row k={<Tag tone="warn" icon={AlertTriangle}>ID only</Tag>}>The campaign is known only by its number</Row>
        <Row k={<Tag tone="muted">unknown</Tag>}>A landing path the shop doesn’t serve</Row>
        <Row k={<Tag tone="warn" icon={ShoppingBag}>Open cart</Tag>}>Items left in the bag, not bought</Row>
        <Row k={<Tag tone="muted" icon={UserX}>No contact</Tag>}>No phone or email captured, so they can’t be reached</Row>
        <Row k={<Tag tone="ok" icon={CheckCircle2}>Pass</Tag>}>The check passed: matched, reconciled</Row>
        <Row k={<Tag tone="info">Not measured yet</Tag>}>The backend doesn’t record this yet; nothing is guessed</Row>
        <Row
          k={
            <span className="anx-leak-tag" style={{ gridColumn: 'auto' }}>
              <AlertTriangle aria-hidden />
              Biggest drop
            </span>
          }
        >
          The funnel step that lost the most people
        </Row>
        <Row k={<StatusChip status="ok" label="Ready" />}>Ads quality: set up and working</Row>
        <Row k={<StatusChip status="warn" label="Partial" />}>Ads quality: works, but something is missing</Row>
        <Row k={<StatusChip status="bad" label="Missing" />}>Ads quality: not set up. Fix before spending more</Row>
        <Row k={<StatusChip status="unk" label="Needs access" />}>Only the ad platform knows. Connect its API to check automatically</Row>
        <Row k={<span className="anx-src-code">Our code</span>}>Checked from the shop’s own code</Row>
        <Row k={<span className="anx-src-code" data-from="data">Our data</span>}>Computed from this range’s visitors and orders</Row>
        <Row k={<span className="anx-src-code" data-from="platform">Ad platform</span>}>Needs the ad platform to confirm</Row>
      </>
    ),
  },
  numbers: {
    title: 'Numbers',
    rows: () => (
      <>
        <Row
          k={
            <b className="anx-num anx-drop">
              0 <small>0%</small>
            </b>
          }
        >
          Red: this step lost more than 90% of at least 5 people
        </Row>
        <Row k={<span className="anx-num anx-zero">0</span>}>Grey zero: nothing happened here</Row>
        <Row k={<span className="anx-num anx-small">48.8%</span>}>Small %: share of the previous step</Row>
        <Row k={<Info className="anx-i-sm" aria-hidden />}>Hover, focus or tap for the exact definition</Row>
        <Row
          k={
            <span className="anx-tg" aria-hidden>
              <button type="button" tabIndex={-1} aria-pressed="true">
                People
              </button>
              <button type="button" tabIndex={-1} aria-pressed="false">
                Events
              </button>
            </span>
          }
        >
          People = unique visitors. Events = every action (one person makes many).
        </Row>
        <Row k={<Ban className="anx-i-sm" aria-hidden />}>A missing part of an ad link</Row>
      </>
    ),
  },
};

export function LegendGrid({ groups }: { groups: LegendGroup[] }) {
  return (
    <div className="anx-lg-grid">
      {groups.map((g) => (
        <section className="anx-lg-g" key={g} aria-label={GROUPS[g].title}>
          <h3>{GROUPS[g].title}</h3>
          {GROUPS[g].rows()}
        </section>
      ))}
    </div>
  );
}

/** The collapsible legend drawer under the status row. */
export default function Legend({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className="anx-ah" id="anx-legend" data-open={open || undefined}>
      <div inert={!open}>
        <div className="anx-lg-panel">
          <div className="anx-lg-head">
            <h2>Legend</h2>
            <button type="button" className="anx-btn anx-btn-ghost anx-btn-icon" aria-label="Collapse legend" onClick={onClose}>
              <X className="anx-i" aria-hidden />
            </button>
          </div>
          <LegendGrid groups={['pages', 'sources', 'channels', 'status', 'numbers']} />
        </div>
      </div>
    </div>
  );
}
