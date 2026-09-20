'use client';

import React, { useState } from 'react';
import {
  defaultPerkIcon,
  newId,
  previewPromiseText,
  PRODUCT_PERK_ICONS,
  PROMISE_SHOW_WHEN_OPTIONS,
  PROMISE_TOKEN_LIST,
} from '@/lib/api/storefront';
import type {
  ProductPerk,
  ProductPerkIcon,
  ProductSectionConfig,
  PromiseShowWhen,
  PromiseTokenValues,
} from '@/lib/api/storefront';

/**
 * The dashboard's own copy of the storefront's line-icon set, purely for
 * picking by sight — the storefront draws the real glyphs itself as inline
 * SVG in its own style (dashboard#125 owner ask: icons with a real theme for
 * MiniRue's promises, not a generic badge set). Kept in sync by hand the
 * same way `MobileMenuEditor`'s `ICON_PATHS` is; drift here only ever costs
 * a slightly different preview, never a broken storefront render.
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

function IconGlyph({ icon, size = 18 }: { icon: ProductPerkIcon; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: '0 0 auto' }}
    >
      {ICON_PATHS[icon]}
    </svg>
  );
}

/**
 * A visual grid, not a dropdown of names — the owner picks by eye, at the
 * same size and line weight the storefront renders (dashboard#125). Opens
 * from a button showing the current glyph; closes on a pick or a second
 * click.
 */
function IconPicker({
  value,
  onChange,
}: {
  value: ProductPerkIcon;
  onChange: (icon: ProductPerkIcon) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', flex: '0 0 auto' }}>
      <button
        type="button"
        className="dash-btn-ghost"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <IconGlyph icon={value} />
        <span>Icon</span>
      </button>
      {open && (
        <div
          className="dash-form-card"
          style={{
            position: 'absolute',
            zIndex: 10,
            top: '100%',
            left: 0,
            marginTop: 4,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 32px)',
            gap: 6,
            padding: 8,
          }}
        >
          {PRODUCT_PERK_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              className="dash-btn-ghost"
              aria-label={icon}
              aria-pressed={icon === value}
              onClick={() => {
                onChange(icon);
                setOpen(false);
              }}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                outline: icon === value ? '2px solid currentColor' : undefined,
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

/**
 * The owner's own promises, shown on a product page only when `showWhen`
 * says they may be — the shop advertises nothing it has not itself said.
 * This used to be a fixed list of shipping/sample copy written into the
 * storefront's code; now it is fully admin-authored content
 * (dashboard#125). See `PromiseShowWhen` for what each option checks.
 */
export default function ProductSectionEditor({
  section,
  facts,
  onChange,
}: {
  section: ProductSectionConfig;
  /** Live values for the token preview and the "currently true" panel — optional so the editor still renders while settings are loading. */
  facts?: PromiseTokenValues & {
    freeShippingIsTrue?: boolean;
    sameDayIsTrue?: boolean;
    codIsTrue?: boolean;
    returnsIsSet?: boolean;
  };
  onChange: (next: ProductSectionConfig) => void;
}) {
  type ResolvedPerk = Required<ProductPerk>;
  const perks: ResolvedPerk[] = (section.perks ?? []).map((p, i) => ({
    enabled: p.enabled ?? true,
    showWhen: p.showWhen ?? 'always',
    order: p.order ?? i,
    ...p,
  }));

  const patchPerk = (index: number, next: ResolvedPerk) =>
    onChange({ ...section, perks: perks.map((p, i) => (i === index ? next : p)) });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= perks.length) return;
    const next = [...perks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...section, perks: next.map((p, i) => ({ ...p, order: i })) });
  };

  return (
    <div className="dash-form-card">
      {facts && (
        <div className="dash-form-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">What&apos;s already advertised automatically</h2>
          </div>
          <p className="dash-hint">
            These are computed live from your other settings, per product — they are facts, not
            promises you write here. A row below with a matching &quot;Only where…&quot; condition
            is allowed to show only where these are true.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li className="dash-hint">
              Free delivery: {facts.freeShippingIsTrue ? 'true for some governorates' : 'not currently true anywhere'}
              {' — '}
              <a href="/dashboard/settings">edit shipping rates</a>
            </li>
            <li className="dash-hint">
              Same-day delivery: {facts.sameDayIsTrue ? 'currently offered' : 'not currently offered'}
              {' — '}
              <a href="/dashboard/fulfillment">edit fulfillment settings</a>
            </li>
            <li className="dash-hint">
              Cash on delivery: {facts.codIsTrue ? 'currently accepted' : 'currently off or unlimited — no cap set'}
              {' — '}
              <a href="/dashboard/settings">edit payment settings</a>
            </li>
            <li className="dash-hint">
              Returns window: {facts.returnsIsSet ? 'currently set' : 'not currently set'}
              {' — '}
              set it on the Trust tab, above.
            </li>
          </ul>
        </div>
      )}

      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Product page promises</h2>
          <button
            type="button"
            className="dash-btn-secondary"
            disabled={perks.length >= MAX_PERKS}
            onClick={() =>
              onChange({
                ...section,
                perks: [
                  ...perks,
                  { id: newId('perk'), icon: defaultPerkIcon('always'), text: '', enabled: true, showWhen: 'always', order: perks.length },
                ],
              })
            }
          >
            Add promise
          </button>
        </div>
        <p className="dash-hint">
          Every word here is yours — the storefront never adds its own copy. Each row shows only
          when its condition is met (see &quot;Show when&quot;), and even then only if
          &quot;Shown on the storefront&quot; is checked. Up to {MAX_PERKS}, in this order.
        </p>
        <p className="dash-hint">
          Tokens you can type into the text, replaced with live values on the storefront:{' '}
          {PROMISE_TOKEN_LIST.map((t) => (
            <code key={t} style={{ marginRight: 6 }}>{t}</code>
          ))}
        </p>

        {perks.length === 0 && (
          <p className="dash-hint">
            Nothing here yet — product pages will show no promises at all until you add one.
          </p>
        )}

        {perks.map((perk, index) => {
          const preview = previewPromiseText(perk.text, facts ?? {});
          return (
            <div
              key={perk.id}
              className="dash-form-card"
              style={{ marginBottom: 8, padding: 12 }}
            >
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <IconPicker
                  value={perk.icon}
                  onChange={(icon) => patchPerk(index, { ...perk, icon })}
                />
                <input
                  className="dash-input"
                  style={{ flex: 1, minWidth: 0 }}
                  value={perk.text}
                  maxLength={160}
                  placeholder="Your own words — e.g. Every order is gift-wrapped by hand"
                  onChange={(e) => patchPerk(index, { ...perk, text: e.target.value })}
                />
                <select
                  className="dash-input"
                  style={{ flex: '0 1 260px', minWidth: 0 }}
                  value={perk.showWhen}
                  onChange={(e) => {
                    const showWhen = e.target.value as PromiseShowWhen;
                    // Re-suggest the icon for the new condition — the owner can
                    // still pick a different one right after (dashboard#125).
                    patchPerk(index, { ...perk, showWhen, icon: defaultPerkIcon(showWhen) });
                  }}
                >
                  {PROMISE_SHOW_WHEN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {perk.text.trim() && (
                <p className="dash-hint">
                  Reads today as: <strong>{preview}</strong>
                </p>
              )}

              <div className="dash-row-actions">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={perk.enabled}
                    onChange={(e) => patchPerk(index, { ...perk, enabled: e.target.checked })}
                  />
                  <span>Shown on the storefront</span>
                </label>
                <button
                  type="button"
                  className="dash-btn-ghost"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="dash-btn-ghost"
                  disabled={index === perks.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={() =>
                    onChange({ ...section, perks: perks.filter((_, i) => i !== index) })
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        {perks.some((p) => !p.text.trim()) && (
          <p className="dash-inline-error">
            A promise with no text is not shown — fill it in or remove it.
          </p>
        )}
      </div>
    </div>
  );
}
