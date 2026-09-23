'use client';

import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Plus, Trash2 } from 'lucide-react';
import {
  defaultPerkIcon,
  newId,
  previewPromiseText,
  PRODUCT_PERK_ICONS,
  PROMISE_SHOW_WHEN_OPTIONS,
  PROMISE_TOKEN_LIST,
} from '@/lib/api/storefront';
import type { ProductPerk, ProductPerkIcon, ProductSectionConfig, PromiseShowWhen, PromiseTokenValues } from '@/lib/api/storefront';
import { moveInList } from '@/lib/storefront/targets';
import Switch from '@/components/dashboard/ui/Switch';

/**
 * The dashboard's own copy of the storefront's line-icon set, purely for
 * picking by sight — the storefront draws the real glyphs itself as inline
 * SVG in its own style (dashboard#125). Kept in sync by hand the same way
 * `MobileMenuEditor`'s `ICON_PATHS` is; drift only ever costs a slightly
 * different picker glyph, never a broken storefront render.
 */
const ICON_PATHS: Record<ProductPerkIcon, React.ReactNode> = {
  truck: <><path d="M3 7h13l3 4v6a2 2 0 0 1-2 2H3V7z" /><circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 10v0M18 14v0" /></>,
  returns: <path d="M4 12a8 8 0 1 1 2.5 5.8M4 12V6M4 12h6" />,
  package: <><path d="M3 8l9-5 9 5-9 5-9-5z" /><path d="M3 8v9l9 5 9-5V8" /><path d="M12 13v9" /></>,
  star: <path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3L3 9.5l6.4-.6z" />,
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />,
  sparkle: <path d="M12 3l1.6 4.9L18.5 9l-4.9 1.6L12 15.5l-1.6-4.9L5.5 9l4.9-1.6z" />,
  support: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="M3 12l2-1M21 12l-2-1" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  leaf: <path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16zM4 20l7-7" />,
  gift: <path d="M4 5h16v4H4zM6 9v11h12V9" />,
  check: <path d="M4 12l5 5L20 6" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.5l-1-.9a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
};

function IconGlyph({ icon }: { icon: ProductPerkIcon }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[icon]}
    </svg>
  );
}

/** A visual grid, not a dropdown of names — the owner picks by eye (dashboard#125). */
function IconPicker({ value, onChange }: { value: ProductPerkIcon; onChange: (icon: ProductPerkIcon) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sfe-iconpick">
      <button type="button" className="sfe-icon-tile sfe-icon-tile-btn" aria-label={`Icon: ${value}. Change`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconGlyph icon={value} />
      </button>
      {open && (
        <div className="sfe-iconpick-pop" role="group" aria-label="Pick an icon">
          {PRODUCT_PERK_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              aria-label={icon}
              aria-pressed={icon === value}
              onClick={() => {
                onChange(icon);
                setOpen(false);
              }}
            >
              <IconGlyph icon={icon} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const MAX_PERKS = 6;

type Facts = PromiseTokenValues & { freeShippingIsTrue?: boolean; sameDayIsTrue?: boolean; codIsTrue?: boolean; returnsIsSet?: boolean };

/** Whether a promise row would show on product pages today, and why — the same rules the storefront applies. */
export function promiseStatus(perk: Required<ProductPerk>, facts: Facts | undefined): { showing: boolean; why: string } {
  if (!perk.text.trim()) return { showing: false, why: 'No words yet' };
  if (!perk.enabled) return { showing: false, why: 'Switched off' };
  const f = facts ?? {};
  switch (perk.showWhen) {
    case 'always':
      return { showing: true, why: 'On every product' };
    case 'freeShipping':
      return f.freeShippingIsTrue ? { showing: true, why: `Where delivery is free: ${f.freeGovernorates}` } : { showing: false, why: 'Delivery is not free anywhere yet' };
    case 'sameDay':
      return f.sameDayIsTrue ? { showing: true, why: `Same-day in ${f.sameDayGovernorates}` } : { showing: false, why: 'Same-day delivery is off' };
    case 'cod':
      return f.codIsTrue ? { showing: true, why: f.codLimit ? `Orders under ${f.codLimit}` : 'Cash on delivery is on' } : { showing: false, why: 'Cash on delivery is off' };
    case 'returns':
      return f.returnsIsSet ? { showing: true, why: `${f.returnsDays}-day window set` } : { showing: false, why: 'No returns window set' };
    case 'reviews':
      return { showing: true, why: 'Only on products that have reviews' };
  }
}

/**
 * The owner's own promises under "Add to bag", each shown only where its
 * condition is true today — the shop advertises nothing it has not itself
 * said (dashboard#125). The facts panel shows what those conditions read from.
 */
export default function ProductSectionEditor({
  section,
  facts,
  onChange,
  onGoToTrust,
}: {
  section: ProductSectionConfig;
  /** Live values from Settings — optional so the editor renders while settings load. */
  facts?: Facts;
  onChange: (next: ProductSectionConfig) => void;
  /** Opens the Trust & contact tab (the returns window lives there). */
  onGoToTrust?: () => void;
}) {
  type ResolvedPerk = Required<ProductPerk>;
  const perks: ResolvedPerk[] = (section.perks ?? []).map((p, i) => ({ enabled: p.enabled ?? true, showWhen: p.showWhen ?? 'always', order: p.order ?? i, ...p }));
  const set = (next: ResolvedPerk[]) => onChange({ ...section, perks: next.map((p, i) => ({ ...p, order: i })) });
  const patchPerk = (index: number, next: ResolvedPerk) => set(perks.map((p, i) => (i === index ? next : p)));
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const insertToken = (index: number, token: string) => {
    const perk = perks[index];
    const el = inputs.current[perk.id];
    const start = el?.selectionStart ?? perk.text.length;
    const end = el?.selectionEnd ?? start;
    patchPerk(index, { ...perk, text: (perk.text.slice(0, start) + token + perk.text.slice(end)).slice(0, 160) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const f = facts;
  const factRows: Array<{ label: string; on: boolean; detail: string; action: React.ReactNode }> = [
    {
      label: 'Free delivery',
      on: !!f?.freeShippingIsTrue,
      detail: f?.freeShippingIsTrue ? `Free to ${f.freeGovernorates}` : 'Not free anywhere',
      action: <a className="sfe-btn sfe-btn-sm sfe-btn-quiet" href="/settings">Shipping rates <ExternalLink aria-hidden /></a>,
    },
    {
      label: 'Same-day delivery',
      on: !!f?.sameDayIsTrue,
      detail: f?.sameDayIsTrue ? `Offered in ${f.sameDayGovernorates}` : 'Not offered',
      action: <a className="sfe-btn sfe-btn-sm sfe-btn-quiet" href="/fulfillment">Fulfillment <ExternalLink aria-hidden /></a>,
    },
    {
      label: 'Cash on delivery',
      on: !!f?.codIsTrue,
      detail: f?.codIsTrue ? (f.codLimit ? `Accepted on orders under ${f.codLimit}` : 'Accepted, no limit set') : 'Off',
      action: <a className="sfe-btn sfe-btn-sm sfe-btn-quiet" href="/settings">Payments <ExternalLink aria-hidden /></a>,
    },
    {
      label: 'Returns window',
      on: !!f?.returnsIsSet,
      detail: f?.returnsIsSet ? `${f.returnsDays} days` : 'Not set',
      action: (
        <button type="button" className="sfe-btn sfe-btn-sm sfe-btn-quiet" onClick={onGoToTrust}>
          Trust &amp; contact
        </button>
      ),
    },
    {
      label: 'Delivery time',
      on: !!f?.deliveryDays,
      detail: f?.deliveryDays ?? 'Not set',
      action: <a className="sfe-btn sfe-btn-sm sfe-btn-quiet" href="/fulfillment">Fulfillment <ExternalLink aria-hidden /></a>,
    },
  ];

  return (
    <>
      <section className="sfe-panel" aria-labelledby="h-facts">
        <div className="sfe-panel-h">
          <div>
            <h2 id="h-facts">What the shop already knows</h2>
            <span className="sfe-meta">Live from your Settings, never typed here. Promises below can be set to show only where these are true.</span>
          </div>
        </div>
        {!facts ? (
          <p className="sfe-empty">Loading your settings…</p>
        ) : (
          <ul className="sfe-rows">
            {factRows.map((r) => (
              <li key={r.label} className="sfe-row sfe-fact">
                <div className="sfe-row-main">
                  <div className="sfe-row-top">
                    <b>{r.label}</b>
                    <span className={`sfe-pill ${r.on ? 'sfe-s-ok' : 'sfe-s-muted'}`}>{r.on ? 'True' : 'Off'}</span>
                  </div>
                  <span className="sfe-summary">{r.detail}</span>
                </div>
                <div className="sfe-row-act">{r.action}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sfe-panel" aria-labelledby="h-promises">
        <div className="sfe-panel-h">
          <div>
            <h2 id="h-promises">Promises under “Add to bag”</h2>
            <span className="sfe-meta">
              {perks.filter((p) => promiseStatus(p, facts).showing).length} of {perks.length} showing today · up to {MAX_PERKS}, in this order
            </span>
          </div>
          <button
            type="button"
            className="sfe-btn sfe-btn-sm"
            disabled={perks.length >= MAX_PERKS}
            onClick={() => set([...perks, { id: newId('perk'), icon: defaultPerkIcon('always'), text: '', enabled: true, showWhen: 'always', order: perks.length }])}
          >
            <Plus aria-hidden /> Add promise
          </button>
        </div>

        {perks.length === 0 && <p className="sfe-empty">No promises yet. Product pages show none until you add one.</p>}

        <ol className="sfe-rows">
          {perks.map((perk, index) => {
            const st = promiseStatus(perk, facts);
            return (
              <li key={perk.id} className="sfe-row">
                <div className="sfe-move">
                  <button type="button" aria-label={`Move promise ${index + 1} up`} disabled={index === 0} onClick={() => set(moveInList(perks, index, -1))}>
                    <ChevronUp aria-hidden />
                  </button>
                  <button type="button" aria-label={`Move promise ${index + 1} down`} disabled={index === perks.length - 1} onClick={() => set(moveInList(perks, index, 1))}>
                    <ChevronDown aria-hidden />
                  </button>
                </div>
                <div className="sfe-row-main">
                  <div className="sfe-perk-line">
                    <IconPicker value={perk.icon} onChange={(icon) => patchPerk(index, { ...perk, icon })} />
                    <label className="sfe-field sfe-grow">
                      <span className="sfe-label">Your words</span>
                      <input
                        ref={(el) => {
                          inputs.current[perk.id] = el;
                        }}
                        className="sfe-input"
                        value={perk.text}
                        maxLength={160}
                        placeholder="e.g. Every order is gift-wrapped by hand"
                        onChange={(e) => patchPerk(index, { ...perk, text: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="sfe-tokens" aria-label="Insert a live value">
                    {PROMISE_TOKEN_LIST.map((t) => (
                      <button key={t} type="button" className="sfe-token" onClick={() => insertToken(index, t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <label className="sfe-field">
                    <span className="sfe-label">Show it</span>
                    <select
                      className="sfe-input"
                      value={perk.showWhen}
                      onChange={(e) => {
                        const showWhen = e.target.value as PromiseShowWhen;
                        // Re-suggest the icon for the new condition; the owner can still pick another (dashboard#125).
                        patchPerk(index, { ...perk, showWhen, icon: defaultPerkIcon(showWhen) });
                      }}
                    >
                      {PROMISE_SHOW_WHEN_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="sfe-row-top">
                    <span className={`sfe-pill ${st.showing ? 'sfe-s-ok' : 'sfe-s-muted'}`}>{st.showing ? 'Showing now' : 'Not showing'}</span>
                    <span className="sfe-summary">{st.why}</span>
                  </div>
                  {perk.text.trim() && (
                    <p className={`sfe-reads${st.showing ? '' : ' sfe-reads-off'}`}>
                      {st.showing ? 'Shoppers read: ' : 'Would read, once true: '}
                      <b>{previewPromiseText(perk.text, facts ?? {})}</b>
                    </p>
                  )}
                </div>
                <div className="sfe-row-act">
                  <Switch checked={perk.enabled} onChange={(v) => patchPerk(index, { ...perk, enabled: v })} label={`Show promise ${index + 1}`} stateLabels={['On', 'Off']} />
                  <button type="button" className="sfe-icon-btn" aria-label={`Remove promise ${index + 1}`} onClick={() => set(perks.filter((_, i) => i !== index))}>
                    <Trash2 aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
