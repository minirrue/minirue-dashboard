'use client';

/**
 * The editor's preview IS the storefront.
 *
 * 1. The unsaved layout is resolved by the backend's own resolver
 *    (POST /v1/storefront/preview — admin only, never saved, never cached).
 * 2. The resolved data is handed to the real storefront, framed from
 *    minirue-frontend `/_internal/draft-preview`, which renders it with the
 *    same components as the live shop (minirue-frontend#193).
 *
 * No admin token ever reaches the storefront origin: only resolved, public
 * shop data crosses, and only to the exact origin we framed.
 *
 * Edit / Browse (dashboard#130): in Edit a click in the preview opens that
 * block's editor; in Browse the shop's own clicks, hovers and keys work
 * (`mr-preview:mode`) and nothing is edited. Links never leave the draft: the
 * frame reports them (`mr-preview:navigate`) and the editor either shows that
 * product or page itself or offers the live page in a new tab.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Hand, Monitor, MousePointerClick, RefreshCw, Smartphone, Tablet, X } from 'lucide-react';
import {
  apiPreviewStorefrontLayout,
  normalizeStorefrontLayoutForSave,
  type StorefrontLayout,
  type StorefrontPreviewData,
} from '@/lib/api/storefront';
import { DRAFT_PREVIEW_PATH, storefrontOrigin } from '@/lib/storefront/origin';

export type PreviewView = 'home' | 'menu' | 'product' | 'page';
export type PreviewDevice = 'desktop' | 'tablet' | 'phone';

/** A real device viewport. The shop's hero is 100vh, so the frame must never be taller than a screen. */
const VIEWPORT: Record<PreviewDevice, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  tablet: { w: 820, h: 1180 },
  phone: { w: 390, h: 844 },
};
const READY_TIMEOUT_MS = 10000;
const DEBOUNCE_MS = 400;
const NAV_NOTE_MS = 8000;
const BROWSE_KEY = 'sfe.preview.browse';

function readBrowse(): boolean {
  try {
    return window.localStorage.getItem(BROWSE_KEY) === '1';
  } catch {
    return false;
  }
}

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

export default function PreviewPane({
  layout,
  view,
  page,
  productSlug,
  highlight,
  device,
  onDeviceChange,
  onSelect,
  onNavigate,
  title,
  subtitle,
  lockDevice,
}: {
  layout: StorefrontLayout;
  view: PreviewView;
  page?: { slug: string; title: string; body: string } | null;
  /** The product the Product page view shows. The shop renders nothing without one. */
  productSlug?: string | null;
  highlight?: string | null;
  device: PreviewDevice;
  onDeviceChange: (d: PreviewDevice) => void;
  /** The owner clicked a block inside the preview. */
  onSelect?: (target: string) => void;
  /** Browse mode: a link was followed. Return true when the editor showed it itself. */
  onNavigate?: (href: string) => boolean;
  title: string;
  subtitle: string;
  /** The phone menu only exists on phones. */
  lockDevice?: PreviewDevice;
}) {
  const origin = storefrontOrigin();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [data, setData] = useState<StorefrontPreviewData | null>(null);
  // Only failures are stored; "ready" is derived from what is actually true.
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  const [nonce, setNonce] = useState(0);
  const [browse, setBrowse] = useState(readBrowse);
  const [navNote, setNavNote] = useState<string | null>(null);
  const shown: PreviewDevice = lockDevice ?? device;

  // Resolve the draft (debounced; the in-flight request is cancelled on every edit).
  useEffect(() => {
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const { layout: clean } = normalizeStorefrontLayoutForSave(layout);
        const resolved = await apiPreviewStorefrontLayout(clean, ctrl.signal);
        setData(resolved);
        setError(null);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const err = e as { status?: number; message?: string };
        setError(
            err.status === 404
              ? 'The live preview is being switched on (the server does not have the preview endpoint yet). Publishing still works.'
              : err.status === 422
                ? `The shop can’t show this draft yet: ${err.message ?? 'a field is invalid'}.`
                : `The preview couldn’t load: ${err.message ?? 'the server did not answer'}.`,
        );
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [layout, nonce]);

  // Messages from the framed storefront — only from the exact origin we framed.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frameRef.current?.contentWindow) return;
      const msg = e.data as { type?: string; target?: string; href?: string };
      if (msg?.type === 'mr-preview:ready') setFrameReady(true);
      if (msg?.type === 'mr-preview:select' && msg.target) onSelect?.(msg.target);
      if (msg?.type === 'mr-preview:navigate' && typeof msg.href === 'string') {
        setNavNote(onNavigate?.(msg.href) ? null : msg.href);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin, onSelect, onNavigate]);

  // Edit or Browse, told to the shop whenever either side changes (a reload resets the frame).
  useEffect(() => {
    if (!frameReady) return;
    frameRef.current?.contentWindow?.postMessage({ type: 'mr-preview:mode', interactive: browse }, origin);
  }, [frameReady, browse, origin, nonce]);

  useEffect(() => {
    if (!navNote) return;
    const t = window.setTimeout(() => setNavNote(null), NAV_NOTE_MS);
    return () => window.clearTimeout(t);
  }, [navNote]);

  const chooseBrowse = useCallback((next: boolean) => {
    setBrowse(next);
    setNavNote(null);
    try {
      window.localStorage.setItem(BROWSE_KEY, next ? '1' : '0');
    } catch {
      // Remembering the choice is a convenience only.
    }
  }, []);

  // Hand the resolved draft to the storefront whenever anything it shows changes.
  // The product view needs a product: the shop ignores a render without one.
  const waitingForProduct = view === 'product' && !productSlug;
  useEffect(() => {
    if (!frameReady || !data || waitingForProduct) return;
    frameRef.current?.contentWindow?.postMessage(
      {
        type: 'mr-preview:render',
        home: data.home,
        chrome: data.chrome,
        view,
        page: page ?? undefined,
        productSlug: view === 'product' ? productSlug ?? undefined : undefined,
        highlight: highlight ?? undefined,
      },
      origin,
    );
  }, [frameReady, data, view, page, productSlug, waitingForProduct, highlight, origin]);

  // If the storefront never says hello, say so instead of showing a blank box.
  useEffect(() => {
    if (frameReady) return;
    const t = window.setTimeout(() => {
      setError((e) => e ?? 'The shop didn’t answer inside the editor. It may still be deploying the preview page.');
    }, READY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [frameReady, nonce]);

  // Scale a true-width render into whatever room the pane has.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setRoom({ w: el.clientWidth, h: Math.max(320, window.innerHeight - (el.closest('.mr-sheet') ? 190 : 230)) });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const retry = useCallback(() => {
    setFrameReady(false);
    setError(null);
    setNonce((n) => n + 1);
  }, []);

  const status: Status = error
    ? { kind: 'error', message: error }
    : frameReady && data && !waitingForProduct
      ? { kind: 'ready' }
      : { kind: 'loading' };
  const vp = VIEWPORT[shown];
  // Fit the whole device screen: as wide as the pane allows, never taller than the window.
  const scale = room.w ? Math.min(1, room.w / vp.w, room.h / vp.h) : 0.4;

  return (
    <aside className="sfe-pv" aria-label="Live preview">
      <div className="sfe-pv-bar">
        <div>
          <h2>Preview · {title}</h2>
          <small>{subtitle}</small>
        </div>
        <div className="sfe-pv-tools">
          <div className="sfe-tg" role="group" aria-label="Clicks in the preview">
            <button type="button" aria-pressed={!browse} onClick={() => chooseBrowse(false)} title="Click a part of the shop to edit it">
              <MousePointerClick aria-hidden /> Edit
            </button>
            <button type="button" aria-pressed={browse} onClick={() => chooseBrowse(true)} title="Use the shop: menus, hovers and keys work, nothing is edited">
              <Hand aria-hidden /> Browse
            </button>
          </div>
          <div className="sfe-tg" role="group" aria-label="Preview size">
            <button type="button" aria-pressed={shown === 'desktop'} disabled={lockDevice === 'phone'} onClick={() => onDeviceChange('desktop')}>
              <Monitor aria-hidden /> Desktop
            </button>
            <button type="button" aria-pressed={shown === 'tablet'} disabled={lockDevice === 'phone'} onClick={() => onDeviceChange('tablet')}>
              <Tablet aria-hidden /> Tablet
            </button>
            <button type="button" aria-pressed={shown === 'phone'} onClick={() => onDeviceChange('phone')}>
              <Smartphone aria-hidden /> Phone
            </button>
          </div>
          <button type="button" className="sfe-icon-btn" aria-label="Reload preview" onClick={retry}>
            <RefreshCw aria-hidden />
          </button>
        </div>
      </div>
      {browse && (
        <p className="sfe-pv-mode" role="status">
          <Hand aria-hidden /> Browsing: clicks, hovers and keys use the shop. Nothing is edited, and links stay in the preview.
        </p>
      )}
      <div className={`sfe-pv-frame sfe-pv-${shown}${browse ? ' is-browse' : ''}`} ref={boxRef}>
        <div className="sfe-pv-box" style={{ width: vp.w * scale, height: vp.h * scale }}>
          <iframe
            key={nonce}
            ref={frameRef}
            title="Storefront preview"
            src={`${origin}${DRAFT_PREVIEW_PATH}`}
            style={{ width: vp.w, height: vp.h, transform: `scale(${scale})` }}
            sandbox="allow-scripts allow-same-origin"
          />
          {navNote && status.kind === 'ready' && (
            <div className="sfe-pv-note" role="status">
              <span>
                That link opens <b>{navNote}</b>, which the preview can’t show with your changes.
              </span>
              <a className="sfe-btn sfe-btn-sm" href={new URL(navNote, origin).toString()} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden /> Open live
              </a>
              <button type="button" className="sfe-icon-btn" aria-label="Dismiss" onClick={() => setNavNote(null)}>
                <X aria-hidden />
              </button>
            </div>
          )}
          {status.kind !== 'ready' && (
            <div className="sfe-pv-over" role="status">
              {status.kind === 'loading' ? (
                <div className="sfe-pv-loading">
                  <span className="sfe-sk" style={{ height: 36 }} />
                  <span className="sfe-sk" style={{ height: 180 }} />
                  <span className="sfe-sk" style={{ height: 120 }} />
                  <small>{waitingForProduct ? 'Choosing a product to show…' : 'Loading the shop with your changes…'}</small>
                </div>
              ) : (
                <div className="sfe-pv-error">
                  <b>Preview unavailable</b>
                  <p>{status.message}</p>
                  <div className="sfe-row-inline">
                    <button type="button" className="sfe-btn sfe-btn-sm" onClick={retry}>
                      <RefreshCw aria-hidden /> Try again
                    </button>
                    <a className="sfe-btn sfe-btn-sm sfe-btn-quiet" href={origin} target="_blank" rel="noopener noreferrer">
                      <ExternalLink aria-hidden /> Open the live shop
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
