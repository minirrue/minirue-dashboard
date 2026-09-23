'use client';

import React from 'react';
import { defaultTrustSettings } from '@/lib/api/storefront';
import type { TrustSettings } from '@/lib/api/storefront';

/**
 * The plain facts behind the storefront's trust promises — not advertising
 * copy. All optional: a blank field means unset, and the storefront shows
 * nothing derived from it rather than a guess.
 *
 * Free delivery, same-day and cash on delivery are deliberately NOT edited
 * here: they are real settings (shipping rates, fulfillment, the COD limit)
 * read live, and a second copy here could disagree with them.
 */
export default function TrustEditor({ trust, onChange }: { trust: TrustSettings | undefined; onChange: (next: TrustSettings) => void }) {
  const value = trust ?? defaultTrustSettings();
  return (
    <section className="sfe-panel" aria-labelledby="h-trust">
      <div className="sfe-panel-h">
        <div>
          <h2 id="h-trust">Trust &amp; contact</h2>
          <span className="sfe-meta">Read by the Contact page, the product page’s contact link, and the promises on the Product page tab.</span>
        </div>
      </div>
      <div className="sfe-panel-b">
        <div className="sfe-grid-2">
          <label className="sfe-field">
            <span className="sfe-label">Returns window</span>
            <span className="sfe-suffix">
              <input
                className="sfe-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={3650}
                value={value.returnsWindowDays ?? ''}
                placeholder="Not set"
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange({ ...value, returnsWindowDays: raw === '' ? null : Math.max(0, Math.trunc(Number(raw))) });
                }}
              />
              <span aria-hidden>days</span>
            </span>
            <span className="sfe-hint">
              {value.returnsWindowDays == null
                ? 'Empty: the shop never claims a returns window, and the returns promise stays hidden.'
                : `Promises and pages show “${value.returnsWindowDays}-day returns”.`}
            </span>
          </label>
          <label className="sfe-field">
            <span className="sfe-label">WhatsApp number</span>
            <input
              className="sfe-input"
              type="tel"
              inputMode="tel"
              value={value.whatsappNumber ?? ''}
              placeholder="+20 10 0000 0000"
              onChange={(e) => onChange({ ...value, whatsappNumber: e.target.value || null })}
            />
            <span className="sfe-hint">Shown on the Contact page and as the product page’s chat link, once set.</span>
          </label>
          <label className="sfe-field sfe-span">
            <span className="sfe-label">Support hours</span>
            <input
              className="sfe-input"
              value={value.supportHours ?? ''}
              placeholder="Sun–Thu, 10:00 AM–6:00 PM Cairo time"
              onChange={(e) => onChange({ ...value, supportHours: e.target.value || null })}
            />
            <span className="sfe-hint">Write times in 12-hour Cairo time.</span>
          </label>
        </div>
        <p className="sfe-hint">
          Free delivery, same-day delivery and cash on delivery aren’t set here. They follow your Settings and Fulfillment, and the Product page tab shows
          where each is true.
        </p>
      </div>
    </section>
  );
}
