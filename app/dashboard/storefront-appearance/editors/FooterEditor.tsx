'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { newId } from '@/lib/api/storefront';
import type { FooterColumn, FooterConfig, PaymentBadge, SocialNetwork, StorefrontPage } from '@/lib/api/storefront';
import { moveInList } from '@/lib/storefront/targets';
import { HrefTargetField } from '../fields/TargetField';
import Switch from '../fields/Switch';

const SOCIAL_NETWORKS: SocialNetwork[] = ['instagram', 'tiktok', 'facebook', 'x', 'youtube', 'whatsapp', 'pinterest'];
const NETWORK_LABEL: Record<SocialNetwork, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', x: 'X', youtube: 'YouTube', whatsapp: 'WhatsApp', pinterest: 'Pinterest',
};

/**
 * Makes a social URL absolute. A bare "instagram.com/minirue" in an href is a
 * RELATIVE path, so the storefront would send shoppers to
 * minirueshop.com/instagram.com/minirue. Anything already carrying a scheme
 * (or an explicit protocol-relative "//") is left alone.
 */
export function withScheme(raw: string): string {
  const url = raw.trim();
  if (!url) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return url;
  return `https://${url}`;
}

const PAYMENT_BADGES: Array<{ value: PaymentBadge; label: string }> = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'instapay', label: 'InstaPay' },
];

export function togglePaymentBadge(list: PaymentBadge[], badge: PaymentBadge): PaymentBadge[] {
  return list.includes(badge) ? list.filter((b) => b !== badge) : [...list, badge];
}

export function blankColumn(): FooterColumn {
  return { id: newId('col'), title: '', links: [] };
}

export default function FooterEditor({
  footer,
  pages,
  onChange,
}: {
  footer: FooterConfig;
  /** The shop's own pages, offered as link destinations. */
  pages: StorefrontPage[];
  onChange: (next: FooterConfig) => void;
}) {
  const set = (patch: Partial<FooterConfig>) => onChange({ ...footer, ...patch });
  const patchColumn = (index: number, next: FooterColumn) => set({ columns: footer.columns.map((c, i) => (i === index ? next : c)) });

  return (
    <>
      <section className="sfe-panel" aria-labelledby="h-foot-news">
        <div className="sfe-panel-h">
          <div>
            <h2 id="h-foot-news">Newsletter and tagline</h2>
            <span className="sfe-meta">The sign-up block at the top of the footer.</span>
          </div>
          <Switch checked={footer.newsletterEnabled} onChange={(v) => set({ newsletterEnabled: v })} label="Newsletter sign-up" stateLabels={['Shown', 'Hidden']} />
        </div>
        <div className="sfe-panel-b sfe-grid-2">
          <label className="sfe-field">
            <span className="sfe-label">Heading</span>
            <input className="sfe-input" value={footer.newsletterEyebrow} onChange={(e) => set({ newsletterEyebrow: e.target.value })} />
          </label>
          <label className="sfe-field">
            <span className="sfe-label">Line under it</span>
            <input className="sfe-input" value={footer.newsletterBlurb} onChange={(e) => set({ newsletterBlurb: e.target.value })} />
          </label>
          <label className="sfe-field sfe-span">
            <span className="sfe-label">Extra tagline (optional)</span>
            <input className="sfe-input" value={footer.tagline ?? ''} onChange={(e) => set({ tagline: e.target.value || null })} />
          </label>
        </div>
      </section>

      <section className="sfe-panel" aria-labelledby="h-foot-cols">
        <div className="sfe-panel-h">
          <div>
            <h2 id="h-foot-cols">Link columns</h2>
            <span className="sfe-meta">Links point at what exists (pages, categories, brands), so none can 404 from a typo.</span>
          </div>
          <button type="button" className="sfe-btn sfe-btn-sm" onClick={() => set({ columns: [...footer.columns, blankColumn()] })}>
            <Plus aria-hidden /> Add column
          </button>
        </div>
        {footer.columns.length === 0 && <p className="sfe-empty">No link columns yet.</p>}
        <ol className="sfe-rows">
          {footer.columns.map((column, index) => (
            <li key={column.id} className="sfe-row">
              <div className="sfe-move">
                <button type="button" aria-label={`Move ${column.title || 'column'} left`} disabled={index === 0} onClick={() => set({ columns: moveInList(footer.columns, index, -1) })}>
                  <ChevronLeft aria-hidden />
                </button>
                <button type="button" aria-label={`Move ${column.title || 'column'} right`} disabled={index === footer.columns.length - 1} onClick={() => set({ columns: moveInList(footer.columns, index, 1) })}>
                  <ChevronRight aria-hidden />
                </button>
              </div>
              <div className="sfe-row-main">
                <label className="sfe-field">
                  <span className="sfe-label">Column title</span>
                  <input className="sfe-input" value={column.title} placeholder="e.g. Help" onChange={(e) => patchColumn(index, { ...column, title: e.target.value })} />
                </label>
                {column.links.map((link, linkIndex) => (
                  <div key={link.id} className="sfe-link-row" data-focus-key={`flink:${link.id}`}>
                    <label className="sfe-field">
                      <span className="sfe-label">Link label</span>
                      <input
                        className="sfe-input"
                        value={link.label}
                        placeholder="e.g. Shipping"
                        onChange={(e) => patchColumn(index, { ...column, links: column.links.map((l, i) => (i === linkIndex ? { ...l, label: e.target.value } : l)) })}
                      />
                    </label>
                    <HrefTargetField
                      use="footer"
                      href={link.href}
                      pages={pages}
                      onChange={(href) => patchColumn(index, { ...column, links: column.links.map((l, i) => (i === linkIndex ? { ...l, href } : l)) })}
                    />
                    <button
                      type="button"
                      className="sfe-icon-btn"
                      aria-label={`Remove link ${link.label || linkIndex + 1}`}
                      onClick={() => patchColumn(index, { ...column, links: column.links.filter((_, i) => i !== linkIndex) })}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  </div>
                ))}
                <button type="button" className="sfe-btn sfe-btn-sm sfe-btn-quiet" onClick={() => patchColumn(index, { ...column, links: [...column.links, { id: newId('l'), label: '', href: '' }] })}>
                  <Plus aria-hidden /> Add link
                </button>
              </div>
              <div className="sfe-row-act">
                <button type="button" className="sfe-icon-btn" aria-label={`Remove column ${column.title || index + 1}`} onClick={() => set({ columns: footer.columns.filter((_, i) => i !== index) })}>
                  <Trash2 aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="sfe-panel" aria-labelledby="h-foot-social">
        <div className="sfe-panel-h">
          <div>
            <h2 id="h-foot-social">Social accounts</h2>
            <span className="sfe-meta">Addresses without https:// get it added, so they never open as a shop page.</span>
          </div>
          <button type="button" className="sfe-btn sfe-btn-sm" onClick={() => set({ socials: [...footer.socials, { id: newId('soc'), network: 'instagram', url: '' }] })}>
            <Plus aria-hidden /> Add account
          </button>
        </div>
        {footer.socials.length === 0 && <p className="sfe-empty">No social accounts.</p>}
        <ol className="sfe-rows">
          {footer.socials.map((social, index) => (
            <li key={social.id} className="sfe-row sfe-row-flat">
              <div className="sfe-row-main sfe-grid-social">
                <label className="sfe-field">
                  <span className="sfe-label">Network</span>
                  <select
                    className="sfe-input"
                    value={social.network}
                    onChange={(e) => set({ socials: footer.socials.map((s, i) => (i === index ? { ...s, network: e.target.value as SocialNetwork } : s)) })}
                  >
                    {SOCIAL_NETWORKS.map((n) => (
                      <option key={n} value={n}>
                        {NETWORK_LABEL[n]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sfe-field">
                  <span className="sfe-label">Address</span>
                  <input
                    className="sfe-input"
                    inputMode="url"
                    value={social.url}
                    placeholder="https://instagram.com/…"
                    onChange={(e) => set({ socials: footer.socials.map((s, i) => (i === index ? { ...s, url: e.target.value } : s)) })}
                    onBlur={(e) => set({ socials: footer.socials.map((s, i) => (i === index ? { ...s, url: withScheme(e.target.value) } : s)) })}
                  />
                </label>
              </div>
              <div className="sfe-row-act">
                <button type="button" className="sfe-icon-btn" aria-label={`Remove ${NETWORK_LABEL[social.network]} account`} onClick={() => set({ socials: footer.socials.filter((_, i) => i !== index) })}>
                  <Trash2 aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="sfe-panel" aria-labelledby="h-foot-legal">
        <div className="sfe-panel-h">
          <h2 id="h-foot-legal">Payment marks and bottom lines</h2>
        </div>
        <div className="sfe-panel-b">
          <div className="sfe-field">
            <span className="sfe-label">Payment marks</span>
            <div className="sfe-switch-row">
              {PAYMENT_BADGES.map(({ value, label }) => (
                <Switch key={value} checked={footer.paymentBadges.includes(value)} onChange={() => set({ paymentBadges: togglePaymentBadge(footer.paymentBadges, value) })} label={label} />
              ))}
            </div>
          </div>
          <div className="sfe-grid-2">
            <label className="sfe-field">
              <span className="sfe-label">Copyright line</span>
              <input className="sfe-input" value={footer.legalLine} onChange={(e) => set({ legalLine: e.target.value })} />
              <span className="sfe-hint">Both spellings, “MiniRue” and “Mini Rue”, are intentional: shoppers search for the spaced one.</span>
            </label>
            <label className="sfe-field">
              <span className="sfe-label">Line on the right</span>
              <input className="sfe-input" value={footer.secondaryLine} onChange={(e) => set({ secondaryLine: e.target.value })} />
            </label>
          </div>
        </div>
      </section>
    </>
  );
}
