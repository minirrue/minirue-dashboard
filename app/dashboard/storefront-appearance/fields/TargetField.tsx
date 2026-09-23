'use client';

/**
 * The single "Goes to" control for the whole Storefront editor.
 *
 * Replaces CtaTargetField (hero button), LinkTargetField (footer/announcement
 * hrefs), the mobile menu's TargetFields and the navbar's inline pickers. Every
 * kind list, label and completeness rule comes from `lib/storefront/targets`.
 *
 * Three rules carried over from the defects documented in #102:
 *  1. Choosing the kind that is already chosen changes nothing.
 *  2. The kind follows the stored value when it changes underneath (a discard,
 *     a reload) — but a deliberate choice is kept while it can still describe
 *     the value (an empty "Custom link" box stays a custom link).
 *  3. Links are written canonical (`/shop/<slug>`, `/shop/all?brandId=<id>`),
 *     and every older shape still opens on the right option.
 */
import React from 'react';
import type { StorefrontPage } from '@/lib/api/storefront';
import { useEntityOptions, type EntityKind, type EntityOption } from '../pickers/EntityPicker';
import {
  TARGET_KINDS,
  TARGET_LABELS,
  blankTarget,
  categorySlugOfHref,
  hrefFor,
  isTargetComplete,
  kindCanHold,
  kindOfHref,
  needsEntity,
  pageSlugs,
  resolveBrandHref,
  type Target,
  type TargetKind,
  type TargetUse,
} from '@/lib/storefront/targets';

const clean = (label: string) => label.replace(/^(—\s*)+/g, '');

function EntitySelect({
  kind,
  value,
  onChange,
  optionValue = (o) => o.id,
  resolve,
}: {
  kind: EntityKind;
  value: string;
  onChange: (value: string, label: string) => void;
  /** How an option maps to the stored value (an id, or an href for links). */
  optionValue?: (o: EntityOption) => string;
  /** Maps a stored value the options can't match directly (a legacy href) onto one. */
  resolve?: (options: EntityOption[]) => string;
}) {
  const { options, loading, error } = useEntityOptions(kind);
  const shown = resolve && !options.some((o) => optionValue(o) === value) ? resolve(options) : value;
  return (
    <>
      <select
        className="sfe-input"
        aria-label={((l) => l.charAt(0).toUpperCase() + l.slice(1))(TARGET_LABELS[kind].replace(/^A /, ''))}
        value={shown}
        disabled={loading}
        onChange={(e) => {
          const opt = options.find((o) => optionValue(o) === e.target.value);
          onChange(e.target.value, opt ? clean(opt.label) : '');
        }}
      >
        <option value="">{loading ? 'Loading…' : options.length ? `Pick ${TARGET_LABELS[kind].toLowerCase()}…` : 'Nothing to pick yet'}</option>
        {options.map((o) => (
          <option key={o.id} value={optionValue(o)}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="sfe-error">{error}</span>}
    </>
  );
}

function KindSelect({ use, value, onChange, label }: { use: TargetUse; value: TargetKind; onChange: (kind: TargetKind) => void; label: string }) {
  return (
    <select
      className="sfe-input sfe-kind"
      aria-label={label}
      value={value}
      onChange={(e) => {
        const next = e.target.value as TargetKind;
        if (next !== value) onChange(next); // rule 1
      }}
    >
      {TARGET_KINDS[use].map((k) => (
        <option key={k} value={k}>
          {TARGET_LABELS[k]}
        </option>
      ))}
    </select>
  );
}

/** For destinations stored as a structured target (hero button, menu items, phone menu). */
export function TargetField({
  use,
  value,
  onChange,
  label = 'Goes to',
}: {
  use: TargetUse;
  value: Target;
  /** `entityLabel` lets a caller fill an empty label from what was picked. */
  onChange: (next: Target, entityLabel?: string) => void;
  label?: string;
}) {
  const unfinished = !isTargetComplete(value);
  return (
    <div className="sfe-field">
      <span className="sfe-label" aria-hidden>{label}</span>
      <div className="sfe-target">
        <KindSelect use={use} label={label} value={value.kind} onChange={(k) => onChange(blankTarget(k))} />
        {needsEntity(value.kind) && (
          <EntitySelect
            kind={value.kind}
            value={value.id ?? ''}
            onChange={(id, entityLabel) => onChange({ kind: value.kind, id }, entityLabel)}
          />
        )}
        {value.kind === 'link' && (
          <input
            className="sfe-input"
            aria-label="Link"
            value={value.href ?? ''}
            placeholder="/shop/all or https://…"
            onChange={(e) => onChange({ kind: 'link', href: e.target.value })}
          />
        )}
      </div>
      {unfinished && <span className="sfe-warn-text">Pick where this goes. Unfinished items are left out when you publish.</span>}
    </div>
  );
}

/** For destinations stored as a plain href (footer links, the announcement link). */
export function HrefTargetField({
  use,
  href,
  pages,
  onChange,
  label = 'Goes to',
  optional = false,
}: {
  use: Extract<TargetUse, 'footer' | 'announcement'>;
  href: string;
  pages: StorefrontPage[];
  onChange: (href: string) => void;
  label?: string;
  /** An empty href is allowed (the announcement link is optional). */
  optional?: boolean;
}) {
  const slugs = React.useMemo(() => pageSlugs(pages), [pages]);
  const [chosen, setChosen] = React.useState<TargetKind | null>(null);
  const derived = kindOfHref(href, slugs);
  // rule 2: a deliberate choice wins only while it can still describe the stored href
  const kind: TargetKind = chosen && kindCanHold(chosen, href, slugs) ? chosen : derived;
  const catSlug = categorySlugOfHref(href);

  return (
    <div className="sfe-field">
      <span className="sfe-label" aria-hidden>{label}</span>
      <div className="sfe-target">
        <KindSelect
          use={use}
          label={label}
          value={kind}
          onChange={(k) => {
            setChosen(k);
            onChange(''); // a stale path from the previous kind must never be saved under the new one
          }}
        />
        {kind === 'page' && (
          <select
            className="sfe-input"
            aria-label="Shop page"
            value={slugs.includes(href.replace(/^\//, '')) ? href.replace(/^\//, '') : ''}
            onChange={(e) => onChange(e.target.value ? hrefFor.page(e.target.value) : '')}
          >
            <option value="">{slugs.length ? 'Pick a page…' : 'No pages yet'}</option>
            {pages.filter((p) => p.slug.trim()).map((p) => (
              <option key={p.id} value={p.slug.trim()}>
                {p.title || p.slug}
              </option>
            ))}
          </select>
        )}
        {kind === 'category' && (
          <EntitySelect
            kind="category"
            value={catSlug ? hrefFor.category(catSlug) : ''}
            optionValue={(o) => (o.slug ? hrefFor.category(o.slug) : `#${o.id}`)}
            onChange={(v) => onChange(v.startsWith('#') ? '' : v)}
          />
        )}
        {kind === 'brand' && (
          <EntitySelect
            kind="brand"
            value={href}
            optionValue={(o) => hrefFor.brand(o.id)}
            resolve={(options) => resolveBrandHref(href, options)}
            onChange={(v) => onChange(v)}
          />
        )}
        {kind === 'link' && (
          <input className="sfe-input" aria-label="Link" value={href} placeholder="https://instagram.com/…" onChange={(e) => onChange(e.target.value)} />
        )}
      </div>
      {!optional && !href.trim() && <span className="sfe-warn-text">Pick where this link goes.</span>}
    </div>
  );
}
