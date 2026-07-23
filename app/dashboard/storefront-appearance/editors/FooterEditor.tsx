'use client';

import React from 'react';
import { newId } from '@/lib/api/storefront';
import type {
  FooterColumn,
  FooterConfig,
  PaymentBadge,
  SocialNetwork,
} from '@/lib/api/storefront';
import { moveInList } from '../pickers/EntityPicker';

const SOCIAL_NETWORKS: SocialNetwork[] = [
  'instagram', 'tiktok', 'facebook', 'x', 'youtube', 'whatsapp', 'pinterest',
];

const PAYMENT_BADGES: Array<{ value: PaymentBadge; label: string }> = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'instapay', label: 'InstaPay' },
];

export function togglePaymentBadge(
  list: PaymentBadge[],
  badge: PaymentBadge,
): PaymentBadge[] {
  return list.includes(badge) ? list.filter((b) => b !== badge) : [...list, badge];
}

export function blankColumn(): FooterColumn {
  return { id: newId('col'), title: '', links: [] };
}

export default function FooterEditor({
  footer,
  onChange,
}: {
  footer: FooterConfig;
  onChange: (next: FooterConfig) => void;
}) {
  const patchColumn = (index: number, next: FooterColumn) =>
    onChange({ ...footer, columns: footer.columns.map((c, i) => (i === index ? next : c)) });

  return (
    <div className="dash-form-card">
      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Newsletter block</h2>
        </div>
        <label className="dash-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={footer.newsletterEnabled}
            onChange={(e) => onChange({ ...footer, newsletterEnabled: e.target.checked })} />
          <span>Show the sign-up block at the top of the footer</span>
        </label>
        <div className="dash-form-grid">
          <label className="dash-field">
            <span className="dash-label">Eyebrow</span>
            <input className="dash-input" value={footer.newsletterEyebrow}
              onChange={(e) => onChange({ ...footer, newsletterEyebrow: e.target.value })} />
          </label>
          <label className="dash-field">
            <span className="dash-label">Blurb</span>
            <input className="dash-input" value={footer.newsletterBlurb}
              onChange={(e) => onChange({ ...footer, newsletterBlurb: e.target.value })} />
          </label>
          <label className="dash-field">
            <span className="dash-label">Extra tagline (optional)</span>
            <input className="dash-input" value={footer.tagline ?? ''}
              onChange={(e) => onChange({ ...footer, tagline: e.target.value || null })} />
          </label>
        </div>
      </div>

      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Link columns</h2>
          <button type="button" className="dash-btn-secondary"
            onClick={() => onChange({ ...footer, columns: [...footer.columns, blankColumn()] })}>
            Add column
          </button>
        </div>

        {footer.columns.length === 0 && (
          <p className="dash-hint">No link columns yet — add one to show links in the footer.</p>
        )}

        {footer.columns.map((column, index) => (
          <div key={column.id} className="dash-form-card" style={{ marginBottom: 12 }}>
            <div className="dash-row-actions" style={{ marginBottom: 8 }}>
              <input
                className="dash-input"
                style={{ flex: 1, minWidth: 0 }}
                value={column.title}
                placeholder="Column title"
                onChange={(e) => patchColumn(index, { ...column, title: e.target.value })}
              />
              <button type="button" className="dash-btn-ghost" disabled={index === 0}
                onClick={() => onChange({ ...footer, columns: moveInList(footer.columns, index, -1) })}>
                Move left
              </button>
              <button type="button" className="dash-btn-ghost" disabled={index === footer.columns.length - 1}
                onClick={() => onChange({ ...footer, columns: moveInList(footer.columns, index, 1) })}>
                Move right
              </button>
              <button type="button" className="dash-btn-ghost"
                onClick={() => onChange({ ...footer, columns: footer.columns.filter((_, i) => i !== index) })}>
                Remove
              </button>
            </div>

            {column.links.map((link, linkIndex) => (
              <div key={link.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input className="dash-input" style={{ flex: 1, minWidth: 0 }} value={link.label} placeholder="Label"
                  onChange={(e) =>
                    patchColumn(index, {
                      ...column,
                      links: column.links.map((l, i) =>
                        i === linkIndex ? { ...l, label: e.target.value } : l,
                      ),
                    })
                  } />
                <input className="dash-input" style={{ flex: 1, minWidth: 0 }} value={link.href} placeholder="/shipping"
                  onChange={(e) =>
                    patchColumn(index, {
                      ...column,
                      links: column.links.map((l, i) =>
                        i === linkIndex ? { ...l, href: e.target.value } : l,
                      ),
                    })
                  } />
                <button type="button" className="dash-btn-ghost"
                  onClick={() =>
                    patchColumn(index, {
                      ...column,
                      links: column.links.filter((_, i) => i !== linkIndex),
                    })
                  }>
                  Remove
                </button>
              </div>
            ))}

            <button type="button" className="dash-btn-ghost"
              onClick={() =>
                patchColumn(index, {
                  ...column,
                  links: [...column.links, { id: newId('l'), label: '', href: '' }],
                })
              }>
              Add link
            </button>
          </div>
        ))}
      </div>

      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Social accounts</h2>
          <button type="button" className="dash-btn-secondary"
            onClick={() =>
              onChange({
                ...footer,
                socials: [...footer.socials, { id: newId('soc'), network: 'instagram', url: '' }],
              })
            }>
            Add account
          </button>
        </div>
        {footer.socials.map((social, index) => (
          <div key={social.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <select
              className="dash-input"
              style={{ flex: '0 0 40%', minWidth: 0 }}
              value={social.network}
              onChange={(e) =>
                onChange({
                  ...footer,
                  socials: footer.socials.map((s, i) =>
                    i === index ? { ...s, network: e.target.value as SocialNetwork } : s,
                  ),
                })
              }
            >
              {SOCIAL_NETWORKS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <input className="dash-input" style={{ flex: 1, minWidth: 0 }} value={social.url}
              placeholder="https://instagram.com/…"
              onChange={(e) =>
                onChange({
                  ...footer,
                  socials: footer.socials.map((s, i) =>
                    i === index ? { ...s, url: e.target.value } : s,
                  ),
                })
              } />
            <button type="button" className="dash-btn-ghost" style={{ flex: '0 0 auto' }}
              onClick={() =>
                onChange({ ...footer, socials: footer.socials.filter((_, i) => i !== index) })
              }>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Payment marks</h2>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {PAYMENT_BADGES.map(({ value, label }) => (
            <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={footer.paymentBadges.includes(value)}
                onChange={() =>
                  onChange({ ...footer, paymentBadges: togglePaymentBadge(footer.paymentBadges, value) })
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Bottom lines</h2>
        </div>
        <label className="dash-field">
          <span className="dash-label">Copyright line</span>
          <input className="dash-input" value={footer.legalLine}
            onChange={(e) => onChange({ ...footer, legalLine: e.target.value })} />
          <span className="dash-hint">
            Both spellings — &quot;MiniRue&quot; and &quot;Mini Rue&quot; — are intentional. Shoppers
            search for the spaced version, so keeping both here helps people find the shop.
          </span>
        </label>
        <label className="dash-field">
          <span className="dash-label">Line on the right</span>
          <input className="dash-input" value={footer.secondaryLine}
            onChange={(e) => onChange({ ...footer, secondaryLine: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
