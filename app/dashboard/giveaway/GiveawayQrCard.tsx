'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import QRCode, { type QRCodeToDataURLOptions } from 'qrcode';
import { Check, Copy, Download, Expand, X } from 'lucide-react';
import type { GiveawayPool } from '@/lib/api/giveaway';
import { assistedReviewOrigin } from '@/lib/storefront/origin';
import { useDialogFocus, useMounted } from './useDialogFocus';

/**
 * Dark on white with the standard four-module quiet zone. Level Q (above the
 * M minimum) keeps the code readable through glare on a booth tablet. Drawn
 * at 1024 px so the full-screen view and the downloaded PNG stay sharp.
 */
export const GIVEAWAY_QR_OPTIONS: QRCodeToDataURLOptions = {
  errorCorrectionLevel: 'Q',
  margin: 4,
  width: 1024,
  color: { dark: '#0B0B0B', light: '#FFFFFF' },
};

export const GIVEAWAY_POOLS: readonly GiveawayPool[] = ['BOOTH', 'ONLINE'];

/** The public page in the same environment as this dashboard (pre or production). */
export function giveawayPublicUrl(pool: GiveawayPool, origin: string = assistedReviewOrigin()): string {
  return `${origin}/giveaway/${pool.toLowerCase()}`;
}

const POOL_COPY: Record<GiveawayPool, { title: string; detail: string }> = {
  BOOTH: {
    title: 'Booth QR code',
    detail: 'Customers at the booth scan this to open the booth giveaway page.',
  },
  ONLINE: {
    title: 'Online QR code',
    detail: 'Share or print this to send people to the online giveaway page.',
  },
};

/** Keeps the booth tablet awake while a customer is scanning. Best effort. */
function useScreenWakeLock(): void {
  React.useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock?.request('screen')
      .then((sentinel) => {
        if (cancelled) void sentinel.release().catch(() => {});
        else lock = sentinel;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void lock?.release().catch(() => {});
    };
  }, []);
}

/**
 * Hides the browser's own bars on a booth tablet. Best effort: the stage
 * already covers the page without it. Leaving full screen the browser's way
 * (Esc, the system gesture) closes the stage too.
 */
function useElementFullscreen(ref: React.RefObject<HTMLElement | null>, onExit: () => void): void {
  const onExitRef = React.useRef(onExit);
  React.useEffect(() => {
    onExitRef.current = onExit;
  });
  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof element.requestFullscreen !== 'function' || document.fullscreenElement) return;
    let entered = false;
    const handleChange = () => {
      if (document.fullscreenElement === element) {
        entered = true;
      } else if (entered) {
        entered = false;
        onExitRef.current();
      }
    };
    document.addEventListener('fullscreenchange', handleChange);
    element.requestFullscreen().catch(() => {});
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => {});
    };
  }, [ref]);
}

function QrStage({ dataUrl, displayUrl, onClose }: {
  dataUrl: string;
  displayUrl: string;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true, onClose);
  useElementFullscreen(ref, onClose);
  useScreenWakeLock();

  return createPortal(
    <div
      ref={ref}
      className="giveaway-qr-stage"
      role="dialog"
      aria-modal="true"
      aria-labelledby="giveaway-qr-stage-caption"
      aria-describedby="giveaway-qr-stage-url"
    >
      <button type="button" className="giveaway-qr-stage-close" onClick={onClose}>
        <X size={22} aria-hidden="true" />
        Close
      </button>
      <figure className="giveaway-qr-stage-figure">
        {/* eslint-disable-next-line @next/next/no-img-element -- a locally generated data URL, nothing for next/image to optimise. */}
        <img src={dataUrl} alt={`QR code for ${displayUrl}`} />
        <figcaption>
          <h2 id="giveaway-qr-stage-caption">Scan to see today&apos;s giveaway</h2>
          <p id="giveaway-qr-stage-url">{displayUrl}</p>
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}

function QrPanel({ pool, off }: { pool: GiveawayPool; off: boolean }) {
  const mounted = useMounted();
  const titleId = React.useId();
  // The origin depends on the dashboard's hostname, so it is read after hydration.
  const url = mounted ? giveawayPublicUrl(pool) : '';
  const [qr, setQr] = React.useState<{ url: string; dataUrl: string } | null>(null);
  const [copied, setCopied] = React.useState<{ url: string; ok: boolean } | null>(null);
  const [staged, setStaged] = React.useState(false);
  const copyTimer = React.useRef<number | undefined>(undefined);
  const closeStage = React.useCallback(() => setStaged(false), []);

  React.useEffect(() => {
    if (!url) return;
    let active = true;
    QRCode.toDataURL(url, GIVEAWAY_QR_OPTIONS)
      .then((dataUrl) => { if (active) setQr({ url, dataUrl }); })
      .catch(() => { if (active) setQr({ url, dataUrl: '' }); });
    return () => { active = false; };
  }, [url]);

  React.useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  // null while drawing, '' when drawing failed.
  const dataUrl = qr && qr.url === url ? qr.dataUrl : null;
  const copyState = copied && copied.url === url ? copied : null;
  const displayUrl = url.replace(/^https?:\/\//, '');
  const copyText = POOL_COPY[pool];

  async function copy() {
    window.clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(url);
      setCopied({ url, ok: true });
      copyTimer.current = window.setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied({ url, ok: false });
    }
  }

  return (
    <div className="giveaway-qr-panel" role="group" aria-labelledby={titleId} data-pool={pool}>
      <div className="giveaway-qr-code">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a locally generated data URL, nothing for next/image to optimise.
          <img src={dataUrl} alt={`QR code for ${displayUrl}`} width={120} height={120} />
        ) : (
          <span className="giveaway-qr-pending" aria-busy={dataUrl === null}>
            {dataUrl === '' ? 'QR code unavailable' : ''}
          </span>
        )}
      </div>
      <div className="giveaway-qr-body">
        <h3 id={titleId}>{copyText.title}</h3>
        <p className="giveaway-qr-detail">{copyText.detail}</p>
        <p className="giveaway-qr-url" data-testid={`giveaway-qr-url-${pool.toLowerCase()}`}>{url}</p>
        {off && (
          <p className="giveaway-qr-off">This page is off right now. Turn it on in Settings before customers scan.</p>
        )}
        <div className="giveaway-qr-actions">
          <button type="button" className="dash-btn-primary" aria-haspopup="dialog" onClick={() => setStaged(true)} disabled={!dataUrl}>
            <Expand size={16} aria-hidden="true" />
            Show full screen
          </button>
          <button type="button" className="dash-btn-secondary" onClick={() => void copy()} disabled={!url}>
            {copyState?.ok ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copyState?.ok ? 'Copied' : 'Copy link'}
          </button>
          {dataUrl ? (
            <a className="dash-btn-secondary" href={dataUrl} download={`minirue-giveaway-${pool.toLowerCase()}-qr.png`}>
              <Download size={16} aria-hidden="true" />
              Download PNG
            </a>
          ) : (
            <button type="button" className="dash-btn-secondary" disabled>
              <Download size={16} aria-hidden="true" />
              Download PNG
            </button>
          )}
        </div>
        <p className="giveaway-qr-status" role="status">
          {copyState ? (copyState.ok ? 'Link copied.' : 'Could not copy. Select the link above and copy it.') : ''}
        </p>
      </div>
      {staged && dataUrl && <QrStage dataUrl={dataUrl} displayUrl={displayUrl} onClose={closeStage} />}
    </div>
  );
}

/** One code per pool. They never change, so the page offers both whichever pool is open below. */
export default function GiveawayQrCodes({ offPool }: { offPool: GiveawayPool | null }) {
  return (
    <section className="dash-card giveaway-qr" aria-labelledby="giveaway-qr-title">
      <div className="giveaway-card-head">
        <div>
          <h2 id="giveaway-qr-title" className="dash-card-title">QR codes</h2>
          <p>The links never change, so you can print them ahead of time.</p>
        </div>
      </div>
      <div className="giveaway-qr-panels">
        {GIVEAWAY_POOLS.map((pool) => <QrPanel key={pool} pool={pool} off={offPool === pool} />)}
      </div>
    </section>
  );
}
