'use client';

import React from 'react';
import { newId } from '@/lib/api/storefront';
import type { ProductPerkIcon, ProductSectionConfig } from '@/lib/api/storefront';

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
 * The service promises shown on every product page. These used to be written
 * into the storefront code, so changing a shipping threshold meant a deploy.
 */
export default function ProductSectionEditor({
  section,
  onChange,
}: {
  section: ProductSectionConfig;
  onChange: (next: ProductSectionConfig) => void;
}) {
  const perks = section.perks ?? [];

  const patchPerk = (index: number, next: ProductSectionConfig['perks'][number]) =>
    onChange({ ...section, perks: perks.map((p, i) => (i === index ? next : p)) });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= perks.length) return;
    const next = [...perks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...section, perks: next });
  };

  return (
    <div className="dash-form-card">
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
                  { id: newId('perk'), icon: 'truck', text: '' },
                ],
              })
            }
          >
            Add promise
          </button>
        </div>
        <p className="dash-hint">
          The short reassurance lines under every product — shipping, samples,
          returns. Shown in this order, up to {MAX_PERKS}.
        </p>

        {perks.length === 0 && (
          <p className="dash-hint">
            Nothing here yet — product pages will show no promises at all.
          </p>
        )}

        {perks.map((perk, index) => (
          <div
            key={perk.id}
            style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}
          >
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
              placeholder="Complimentary shipping over EGP 3,000"
              onChange={(e) => patchPerk(index, { ...perk, text: e.target.value })}
            />
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
        ))}

        {perks.some((p) => !p.text.trim()) && (
          <p className="dash-inline-error">
            A promise with no text is not shown — fill it in or remove it.
          </p>
        )}
      </div>
    </div>
  );
}
