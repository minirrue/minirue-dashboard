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
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet } from 'lucide-react';
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

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

export default function PreviewPane({
  layout,
  view,
  page,
  highlight,
  device,
  onDeviceChange,
  onSelect,
  title,
  subtitle,
  lockDevice,
}: {
  layout: StorefrontLayout;
  view: PreviewView;
  page?: { slug: string; title: string; body: string } | null;
  highlight?: string | null;
  device: PreviewDevice;
  onDeviceChange: (d: PreviewDevice) => void;
  /** The owner clicked a block inside the preview. */
  onSelect?: (target: string) => void;
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
      const msg = e.data as { type?: string; target?: string };
      if (msg?.type === 'mr-preview:ready') setFrameReady(true);
      if (msg?.type === 'mr-preview:select' && msg.target) onSelect?.(msg.target);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin, onSelect]);

  // Hand the resolved draft to the storefront whenever anything it shows changes.
  useEffect(() => {
    if (!frameReady || !data) return;
    frameRef.current?.contentWindow?.postMessage(
      { type: 'mr-preview:render', home: data.home, chrome: data.chrome, view, page: page ?? undefined, highlight: highlight ?? undefined },
      origin,
    );
  }, [frameReady, data, view, page, highlight, origin]);

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
    const measure = () => setRoom({ w: el.clientWidth, h: Math.max(320, window.innerHeight - (el.closest('.sfe-sheet') ? 190 : 230)) });
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

  const status: Status = error ? { kind: 'error', message: error } : frameReady && data ? { kind: 'ready' } : { kind: 'loading' };
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
      <div className={`sfe-pv-frame sfe-pv-${shown}`} ref={boxRef}>
        <div className="sfe-pv-box" style={{ width: vp.w * scale, height: vp.h * scale }}>
          <iframe
            key={nonce}
            ref={frameRef}
            title="Storefront preview"
            src={`${origin}${DRAFT_PREVIEW_PATH}`}
            style={{ width: vp.w, height: vp.h, transform: `scale(${scale})` }}
            sandbox="allow-scripts allow-same-origin"
          />
          {status.kind !== 'ready' && (
            <div className="sfe-pv-over" role="status">
              {status.kind === 'loading' ? (
                <div className="sfe-pv-loading">
                  <span className="sfe-sk" style={{ height: 36 }} />
                  <span className="sfe-sk" style={{ height: 180 }} />
                  <span className="sfe-sk" style={{ height: 120 }} />
                  <small>Loading the shop with your changes…</small>
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
