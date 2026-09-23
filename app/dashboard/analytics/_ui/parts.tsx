'use client';

import React, { useId, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Check,
  CheckCircle2,
  ChevronRight,
  Filter,
  Info,
  LogOut,
  MousePointerClick,
  Package,
  Receipt,
  Search,
  ShoppingBag,
  Store,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type { PageKind } from '@/lib/analytics/journey';
import { PAGE_KIND_LABEL } from '@/lib/analytics/journey';
import { platformPill } from '@/lib/analytics/source';
import type { CheckStatus, Answer } from '@/lib/analytics/model';
import { ariaSort, type SortState } from '@/lib/analytics/sort';

/* ── Definitions behind every headline number ───────────────────────────── */

export const DEFS: Record<string, React.ReactNode> = {
  visitors: (
    <>
      <b>Unique visitors.</b> One person = one browser visitor ID with a visitor number. Fingerprints are not merged across days.
      Excludes you, staff, anyone marked “This is us” and bots.
    </>
  ),
  viewed: (
    <>
      <b>Viewed a product.</b> People who opened at least one product page. Not the number of product views.
    </>
  ),
  bag: (
    <>
      <b>Added to bag.</b> People who added at least one item to the bag, or got further.
    </>
  ),
  checkout: (
    <>
      <b>Reached checkout.</b> People who started checkout (contact step or later).
    </>
  ),
  purchased: (
    <>
      <b>Purchased.</b> People with a paid order, matched to a backend order, not a pixel event.
    </>
  ),
  events: (
    <>
      <b>Events.</b> Raw tracked actions (page views, product views, add-to-bag…). One person creates many.
    </>
  ),
  people: (
    <>
      <b>People.</b> Unique visitors, counted once however many times they came back.
    </>
  ),
  addToCartEvents: (
    <>
      <b>Add-to-bag events.</b> Every time the product was added, from the product rollup. Not people, and not narrowed by filters.
    </>
  ),
};

/* ── Pills ──────────────────────────────────────────────────────────────── */

const KIND_ICON: Record<PageKind, LucideIcon> = {
  home: Store,
  category: Filter,
  product: Package,
  bag: ShoppingBag,
  checkout: Receipt,
  page: FileText,
  unknown: AlertTriangle,
  action: MousePointerClick,
  exit: LogOut,
};

export function PagePill({ kind }: { kind: PageKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className="anx-kp" data-k={kind}>
      <Icon aria-hidden />
      {PAGE_KIND_LABEL[kind]}
    </span>
  );
}

/** The colour-coded platform pill. `label` defaults to the platform name. */
export function SourcePill({ platform, label, warn }: { platform: string | null | undefined; label?: string; warn?: boolean }) {
  return (
    <span className="anx-sp" data-p={platformPill(platform)}>
      {label ?? (platform || 'Direct')}
      {warn ? <AlertTriangle aria-label="campaign can’t be credited" /> : null}
    </span>
  );
}

const STATUS: Record<CheckStatus, { label: string; Icon: LucideIcon }> = {
  ok: { label: 'Ready', Icon: CheckCircle2 },
  warn: { label: 'Partial', Icon: AlertTriangle },
  bad: { label: 'Missing', Icon: Ban },
  unk: { label: 'Needs access', Icon: Info },
  na: { label: 'Not used', Icon: Ban },
};

export function StatusChip({ status, label }: { status: CheckStatus; label?: string }) {
  const { Icon, label: fallback } = STATUS[status];
  return (
    <span className="anx-st" data-tone={status}>
      <Icon aria-hidden />
      {label || fallback}
    </span>
  );
}

export function Tag({ tone, icon: Icon, children }: { tone: 'warn' | 'bad' | 'ok' | 'muted' | 'info'; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="anx-tag" data-tone={tone}>
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="anx-dot" style={{ background: color }} aria-hidden />;
}

/* ── Definition tooltip: hover, focus or tap ────────────────────────────── */

export function InfoTip({ def, label, side = 'top' }: { def: string; label: string; side?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="anx-tipwrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="anx-tipbtn"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        <Info className="anx-i-sm" aria-hidden />
      </button>
      {open ? (
        <span role="tooltip" id={id} className="anx-tip" data-side={side}>
          {DEFS[def]}
        </span>
      ) : null}
    </span>
  );
}

/* ── Layout pieces ──────────────────────────────────────────────────────── */

export function Panel({
  id,
  title,
  meta,
  tools,
  children,
  as: As = 'section',
}: {
  id?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  tools?: React.ReactNode;
  children: React.ReactNode;
  as?: 'section' | 'nav';
}) {
  const hid = `${id ?? 'p'}-h`;
  return (
    <As className="anx-panel" id={id} aria-labelledby={hid}>
      <div className="anx-panel-h">
        <div>
          <h2 id={hid}>{title}</h2>
          {meta ? <span className="anx-meta">{meta}</span> : null}
        </div>
        {tools}
      </div>
      {children}
    </As>
  );
}

export function AnswerLine({ answer, onJump }: { answer: Answer; onJump: (a: Answer['jump']) => void }) {
  return (
    <p className="anx-answer">
      <ArrowRight className="anx-i" aria-hidden />
      <span>
        {answer.text}
        {answer.strong ? <b>{answer.strong}</b> : null}
      </span>
      <button type="button" className="anx-link" onClick={() => onJump(answer.jump)}>
        {answer.action}
      </button>
    </p>
  );
}

export function SortTh<K extends string>({
  k,
  label,
  sort,
  onSort,
  left,
}: {
  k: K;
  label: string;
  sort: SortState<K>;
  onSort: (k: K) => void;
  left?: boolean;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 'desc' ? ArrowDown : ArrowUp;
  return (
    <th scope="col" className={left ? 'anx-tl' : undefined} aria-sort={ariaSort(sort, k)}>
      <button type="button" className="anx-sort" onClick={() => onSort(k)}>
        {label}
        <Icon aria-hidden />
      </button>
    </th>
  );
}

export function SearchBox({ id, value, onChange, placeholder, label }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="anx-search" htmlFor={id}>
      <span className="anx-sr">{label}</span>
      <Search className="anx-i" aria-hidden />
      <input id={id} type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </label>
  );
}

export function ToggleGroup<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <div className="anx-tg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RowToggle({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" className="anx-rowexp" aria-expanded={open} aria-label={label} onClick={onToggle}>
      <ChevronRight aria-hidden />
    </button>
  );
}

export function Skeleton({ h, w = '100%' }: { h: number; w?: string }) {
  return <div className="anx-sk" style={{ height: h, width: w }} />;
}

export function Zero({ n }: { n: number }) {
  return n ? <>{n.toLocaleString('en-US')}</> : <span className="anx-zero">0</span>;
}

export { Check };
