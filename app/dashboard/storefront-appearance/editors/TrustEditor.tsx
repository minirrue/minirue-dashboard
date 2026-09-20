'use client';

import React from 'react';
import { defaultTrustSettings } from '@/lib/api/storefront';
import type { TrustSettings } from '@/lib/api/storefront';

/**
 * The plain facts behind the storefront's trust promises — not advertising
 * copy. All optional: leaving a field blank means the storefront treats it
 * as unset and shows nothing derived from it, rather than a guess.
 *
 * Free delivery, same-day delivery and cash-on-delivery are deliberately NOT
 * edited here — those already exist as real settings (shipping rates,
 * fulfillment delivery methods, the COD limit) and are read live from there.
 * Duplicating them here would let this screen and the real setting disagree.
 * What IS advertised from them is controlled on the Product section tab's
 * promise rows (`showWhen`), not here.
 */
export default function TrustEditor({
  trust,
  onChange,
}: {
  trust: TrustSettings | undefined;
  onChange: (next: TrustSettings) => void;
}) {
  const value = trust ?? defaultTrustSettings();

  return (
    <div className="dash-form-card">
      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Trust</h2>
        </div>
        <p className="dash-hint">
          Optional facts the Contact page, the product page&apos;s contact link, and the
          &quot;Only where…&quot; promise rows on the Product section tab read. Leave anything
          blank that isn&apos;t true yet — a blank field is never shown as though it were a fact.
        </p>

        <div className="dash-form-grid">
          <label className="dash-field">
            <span className="dash-label">Returns window (days)</span>
            <input
              className="dash-input"
              type="number"
              min={0}
              max={3650}
              value={value.returnsWindowDays ?? ''}
              placeholder="e.g. 14"
              onChange={(e) => {
                const raw = e.target.value;
                onChange({
                  ...value,
                  returnsWindowDays: raw === '' ? null : Math.max(0, Math.trunc(Number(raw))),
                });
              }}
            />
            <span className="dash-hint">
              Blank means no returns window is set — the storefront will not claim one exists,
              and no promise row conditioned on &quot;returns&quot; can show.
            </span>
          </label>

          <label className="dash-field">
            <span className="dash-label">WhatsApp number</span>
            <input
              className="dash-input"
              value={value.whatsappNumber ?? ''}
              placeholder="e.g. +20 10 0000 0000"
              onChange={(e) => onChange({ ...value, whatsappNumber: e.target.value || null })}
            />
            <span className="dash-hint">
              Shown on the Contact page and as the product page&apos;s contact link, once set.
            </span>
          </label>

          <label className="dash-field">
            <span className="dash-label">Support hours</span>
            <input
              className="dash-input"
              value={value.supportHours ?? ''}
              placeholder="e.g. Sun–Thu, 10am–6pm Cairo time"
              onChange={(e) => onChange({ ...value, supportHours: e.target.value || null })}
            />
          </label>
        </div>

        <p className="dash-hint" style={{ marginTop: 8 }}>
          Cash on delivery, free delivery and same-day delivery are not set here — they follow
          your existing Settings (shipping rates, fulfillment, and the COD limit) and are checked
          live, per product, by the promise rows on the Product section tab.
        </p>
      </div>
    </div>
  );
}
