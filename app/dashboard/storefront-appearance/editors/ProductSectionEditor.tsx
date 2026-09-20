'use client';

import React from 'react';
import { newId, previewPromiseText, PROMISE_SHOW_WHEN_OPTIONS, PROMISE_TOKEN_LIST } from '@/lib/api/storefront';
import type {
  ProductPerk,
  ProductPerkIcon,
  ProductSectionConfig,
  PromiseShowWhen,
  PromiseTokenValues,
} from '@/lib/api/storefront';

/** Must stay in step with the storefront's Icon component. */
const PERK_ICONS: Array<{ value: ProductPerkIcon; label: string }> = [
  { value: 'truck', label: 'Delivery van' },
  { value: 'gift', label: 'Gift box' },
  { value: 'check', label: 'Tick' },
  { value: 'heart', label: 'Heart' },
  { value: 'grid', label: 'Grid' },
];

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
                  { id: newId('perk'), icon: 'truck', text: '', enabled: true, showWhen: 'always', order: perks.length },
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
                <select
                  className="dash-input"
                  style={{ flex: '0 1 160px', minWidth: 0 }}
                  value={perk.icon}
                  onChange={(e) =>
                    patchPerk(index, { ...perk, icon: e.target.value as ProductPerkIcon })
                  }
                >
                  {PERK_ICONS.map((icon) => (
                    <option key={icon.value} value={icon.value}>
                      {icon.label}
                    </option>
                  ))}
                </select>
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
                  onChange={(e) =>
                    patchPerk(index, { ...perk, showWhen: e.target.value as PromiseShowWhen })
                  }
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
