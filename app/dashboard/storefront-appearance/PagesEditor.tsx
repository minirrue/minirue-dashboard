'use client';

import React, { useState } from 'react';
import { Eye, FileText, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { PROMISE_TOKEN_LIST, createTrustPages, newPage, slugify } from '@/lib/api/storefront';
import type { StorefrontPage } from '@/lib/api/storefront';
import { hasPlaceholders, pageAddressProblem } from '@/lib/storefront/checks';
import Sheet from './fields/Sheet';
import Switch from './fields/Switch';

/**
 * Standalone pages at minirueshop.com/<address> — Terms, Privacy, Shipping,
 * Returns, Contact and anything else. The address rules (format, built-in shop
 * addresses, duplicates) live in `lib/storefront/checks` so the list, the
 * sheet, the tab badge and "Before you publish" all agree. Partner shop
 * addresses are still checked by the server when publishing.
 */
export default function PagesEditor({
  pages,
  onChange,
  selectedId,
  onSelect,
  notify,
}: {
  pages: StorefrontPage[];
  onChange: (next: StorefrontPage[]) => void;
  /** The page shown in the preview. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  notify: (msg: string, undo?: () => void) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  // Slug auto-fills from the title until the owner types in the address field.
  const [manualSlug, setManualSlug] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (id: string, next: Partial<StorefrontPage>) => onChange(pages.map((p) => (p.id === id ? { ...p, ...next } : p)));
  const page = pages.find((p) => p.id === editing) ?? null;

  const addTrustPages = () => {
    const { pages: next, added } = createTrustPages(pages);
    if (added.length) {
      onChange(next);
      notify(`Added ${added.length} page${added.length > 1 ? 's' : ''}, hidden, with [placeholders] to fill in`);
    } else {
      notify('You already have all of them. Nothing changed');
    }
  };

  return (
    <section className="sfe-panel" aria-labelledby="h-pages">
      <div className="sfe-panel-h">
        <div>
          <h2 id="h-pages">Pages</h2>
          <span className="sfe-meta">
            {pages.filter((p) => p.enabled).length} shown, {pages.filter((p) => !p.enabled).length} hidden. Click a page to see it in the preview.
          </span>
        </div>
        <div className="sfe-row-inline">
          <button type="button" className="sfe-btn sfe-btn-sm" onClick={addTrustPages}>
            <ShieldCheck aria-hidden /> Add the pages shoppers look for
          </button>
          <button
            type="button"
            className="sfe-btn sfe-btn-sm"
            onClick={() => {
              const p = newPage();
              onChange([...pages, p]);
              onSelect(p.id);
              setEditing(p.id);
            }}
          >
            <Plus aria-hidden /> New page
          </button>
        </div>
      </div>
      <p className="sfe-hint sfe-pad">
        “Add the pages shoppers look for” creates Contact, About, Shipping, Returns, Terms, Privacy and Imprint when missing, hidden, with honest
        [placeholders] and live values like {'{returnsDays}'} instead of typed numbers. Terms and Privacy are drafting scaffolds, not legal advice.
      </p>

      {pages.length === 0 && <p className="sfe-empty">No pages yet.</p>}
      <ul className="sfe-rows">
        {pages.map((p) => {
          const problem = pageAddressProblem(p, pages);
          return (
            <li key={p.id} className={`sfe-row${selectedId === p.id ? ' sfe-selected' : ''}`} data-focus-key={`page:${p.id}`}>
              <span className="sfe-icon-tile">
                <FileText aria-hidden />
              </span>
              <div className="sfe-row-main">
                <button type="button" className="sfe-row-link" onClick={() => onSelect(p.id)} aria-pressed={selectedId === p.id}>
                  <b>{p.title || 'Untitled page'}</b>
                  <span className="sfe-mono">/{p.slug || '…'}</span>
                </button>
                <div className="sfe-row-top">
                  <span className={`sfe-pill ${p.enabled ? 'sfe-s-ok' : 'sfe-s-muted'}`}>
                    {p.enabled ? <Eye aria-hidden /> : null}
                    {p.enabled ? 'Shown' : 'Hidden'}
                  </span>
                  {problem && <span className="sfe-pill sfe-s-bad">Can’t publish</span>}
                  {!problem && p.enabled && hasPlaceholders(p.body) && <span className="sfe-pill sfe-s-warn">[placeholders]</span>}
                </div>
                {problem && <span className="sfe-error">{problem}</span>}
              </div>
              <div className="sfe-row-act">
                <button
                  type="button"
                  className="sfe-btn sfe-btn-sm"
                  onClick={() => {
                    onSelect(p.id);
                    setEditing(p.id);
                  }}
                >
                  <Pencil aria-hidden /> Edit
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {page && (
        <Sheet
          title={page.title || 'Untitled page'}
          subtitle={`minirueshop.com/${page.slug || '…'}`}
          onClose={() => {
            setEditing(null);
            setConfirmDelete(false);
          }}
          footer={
            <>
              <button type="button" className="sfe-btn sfe-btn-quiet sfe-danger-text" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden /> Delete page
              </button>
              <button type="button" className="sfe-btn sfe-btn-primary" onClick={() => setEditing(null)}>
                Done
              </button>
            </>
          }
        >
          {confirmDelete && (
            <div className="sfe-confirm" role="alert">
              <p>
                <b>Delete “{page.title || 'Untitled page'}”?</b> /{page.slug} will show “page not found”. To keep the text, hide the page instead.
              </p>
              <div className="sfe-row-inline">
                <button
                  type="button"
                  className="sfe-btn"
                  data-autofocus
                  onClick={() => {
                    patch(page.id, { enabled: false });
                    setConfirmDelete(false);
                    notify('Page hidden. Its text is kept');
                  }}
                >
                  Hide instead
                </button>
                <button
                  type="button"
                  className="sfe-btn sfe-btn-danger"
                  onClick={() => {
                    const before = pages; // the list as it was, page included, in its place
                    onChange(pages.filter((x) => x.id !== page.id));
                    setEditing(null);
                    setConfirmDelete(false);
                    notify('Page deleted', () => onChange(before));
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
          <PageFields
            page={page}
            all={pages}
            manual={manualSlug.has(page.id)}
            onManual={() => setManualSlug((prev) => new Set(prev).add(page.id))}
            onPatch={(next) => patch(page.id, next)}
          />
        </Sheet>
      )}
    </section>
  );
}

function PageFields({
  page,
  all,
  manual,
  onManual,
  onPatch,
}: {
  page: StorefrontPage;
  all: StorefrontPage[];
  manual: boolean;
  onManual: () => void;
  onPatch: (next: Partial<StorefrontPage>) => void;
}) {
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const problem = pageAddressProblem(page, all);

  const insertToken = (token: string) => {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? page.body.length;
    const end = ta.selectionEnd ?? start;
    const next = page.body.slice(0, start) + token + page.body.slice(end);
    onPatch({ body: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="sfe-stack">
      <div className="sfe-grid-2">
        <label className="sfe-field">
          <span className="sfe-label">Title</span>
          <input
            className="sfe-input"
            value={page.title}
            placeholder="Privacy Policy"
            onChange={(e) => onPatch({ title: e.target.value, ...(manual ? {} : { slug: slugify(e.target.value) }) })}
          />
        </label>
        <label className="sfe-field">
          <span className="sfe-label">Address</span>
          <span className="sfe-prefix">
            <span aria-hidden>/</span>
            <input
              className={`sfe-input${problem ? ' sfe-bad' : ''}`}
              value={page.slug}
              placeholder="privacy-policy"
              aria-invalid={!!problem}
              onChange={(e) => {
                onManual();
                onPatch({ slug: e.target.value });
              }}
            />
          </span>
          {problem ? <span className="sfe-error">{problem}</span> : <span className="sfe-hint">minirueshop.com/{page.slug}</span>}
        </label>
      </div>
      <label className="sfe-field">
        <span className="sfe-label">Page text</span>
        <textarea ref={bodyRef} className="sfe-input sfe-mono-input" rows={14} value={page.body} onChange={(e) => onPatch({ body: e.target.value })} />
        <span className="sfe-hint">
          Markdown: # Heading, **bold**, [link](https://…), - list. Insert a live value:{' '}
          {PROMISE_TOKEN_LIST.map((t) => (
            <button key={t} type="button" className="sfe-token" onClick={() => insertToken(t)}>
              {t}
            </button>
          ))}
        </span>
      </label>
      <Switch checked={page.enabled} onChange={(v) => onPatch({ enabled: v })} label="Shown on the shop" />
    </div>
  );
}
