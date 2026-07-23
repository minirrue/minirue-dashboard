'use client';

import React, { useState } from 'react';
import { newPage, slugify, SLUG_PATTERN } from '@/lib/api/storefront';
import type { StorefrontPage } from '@/lib/api/storefront';

export default function PagesEditor({
  pages,
  onChange,
}: {
  pages: StorefrontPage[];
  onChange: (next: StorefrontPage[]) => void;
}) {
  // Slug auto-fills from the title until the admin types in the slug field
  // directly — once that happens for a page, stop overwriting their choice.
  const [manualSlugIds, setManualSlugIds] = useState<Set<string>>(new Set());

  const patchPage = (index: number, next: StorefrontPage) =>
    onChange(pages.map((p, i) => (i === index ? next : p)));

  const slugCounts = pages.reduce<Record<string, number>>((acc, p) => {
    const key = p.slug.trim();
    if (key) acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="dash-form-card">
      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Pages</h2>
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => onChange([...pages, newPage()])}
          >
            Add page
          </button>
        </div>
        <p className="dash-hint">
          Terms, Privacy, Shipping, Returns, and any other standalone page shown at
          /pages/&lt;slug&gt; on the storefront.
        </p>

        {pages.length === 0 && (
          <p className="dash-hint">No pages yet — add one to publish it on the storefront.</p>
        )}

        {pages.map((page, index) => {
          const trimmedSlug = page.slug.trim();
          const slugInvalid = trimmedSlug === '' || !SLUG_PATTERN.test(trimmedSlug);
          const slugDuplicate = trimmedSlug !== '' && (slugCounts[trimmedSlug] ?? 0) > 1;
          const titleInvalid = page.title.trim() === '';

          return (
            <div key={page.id} className="dash-form-card" style={{ marginBottom: 12 }}>
              <div className="dash-form-grid">
                <label className="dash-field">
                  <span className="dash-label">Title</span>
                  <input
                    className="dash-input"
                    value={page.title}
                    placeholder="Privacy Policy"
                    onChange={(e) => {
                      const title = e.target.value;
                      const shouldAutoSync = !manualSlugIds.has(page.id);
                      patchPage(index, {
                        ...page,
                        title,
                        slug: shouldAutoSync ? slugify(title) : page.slug,
                      });
                    }}
                  />
                </label>
                <label className="dash-field">
                  <span className="dash-label">Slug</span>
                  <input
                    className="dash-input"
                    value={page.slug}
                    placeholder="privacy-policy"
                    onChange={(e) => {
                      setManualSlugIds((prev) => new Set(prev).add(page.id));
                      patchPage(index, { ...page, slug: e.target.value });
                    }}
                  />
                </label>
              </div>

              <p className="dash-hint">
                Public URL: <code>/pages/{trimmedSlug || '…'}</code>
              </p>
              {titleInvalid && <p className="dash-inline-error">Title is required.</p>}
              {slugInvalid && (
                <p className="dash-inline-error">
                  Slug must be lowercase letters, numbers and hyphens only (e.g. &quot;privacy-policy&quot;).
                </p>
              )}
              {!slugInvalid && slugDuplicate && (
                <p className="dash-inline-error">
                  This slug is used by another page — only one can be saved.
                </p>
              )}

              <label className="dash-field">
                <span className="dash-label">Body (Markdown)</span>
                <textarea
                  className="dash-input"
                  rows={10}
                  value={page.body}
                  onChange={(e) => patchPage(index, { ...page, body: e.target.value })}
                />
                <span className="dash-hint">
                  Use Markdown: # Heading, **bold**, [link](https://…), - list item
                </span>
              </label>

              <div className="dash-row-actions" style={{ marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={page.enabled}
                    onChange={(e) => patchPage(index, { ...page, enabled: e.target.checked })}
                  />
                  <span>Shown on the storefront</span>
                </label>
                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={() => onChange(pages.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
