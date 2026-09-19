'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { apiMintDeviceLink, apiOrigin } from '@/lib/api/traffic-flags';
import type { ApiError } from '@/lib/api/client';

function remaining(expiresAt: string, now: number): string {
  const s = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * "Exclude another device" (dashboard#111). The old exclusion only marked a
 * device when someone signed in to the dashboard on it, so the owner's phone
 * and every in-app browser (Instagram, TikTok, Facebook — each keeps its own
 * cookies) kept counting. This mints a 30-minute link: scan the QR on the
 * phone, or paste the link inside the in-app browser, and that browser is
 * excluded — no sign-in.
 */
export default function ExcludeDeviceLink() {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [svg, setSvg] = useState<string>('');
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!link) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [link]);

  async function mint() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const { path, expiresAt } = await apiMintDeviceLink();
      const url = `${apiOrigin()}${path}`;
      setSvg(await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }));
      setLink({ url, expiresAt });
      setNow(Date.now());
      setOpen(true);
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not create a link.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const expired = link ? new Date(link.expiresAt).getTime() <= now : false;

  return (
    <div className="dash-exclude-device" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <button
        type="button"
        className="dash-btn-secondary"
        disabled={busy}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : void mint())}
      >
        {busy ? 'Creating link…' : 'Exclude another device'}
      </button>
      {open && (
        <div className="dash-exclude-device__panel" role="dialog" aria-label="Exclude another device">
          <div
            className="dash-exclude-device__qr"
            data-expired={expired || undefined}
            aria-hidden="true"
            // The SVG is generated locally by `qrcode` from our own URL.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="dash-exclude-device__copy">
            <strong>Scan with the phone you shop from</strong>
            <p>
              For Instagram, TikTok or Facebook, also open the link inside that app — each keeps its own
              browser. Visits, carts and orders from there stop counting and are never sent to ad platforms.
            </p>
          </div>
          <div className="dash-exclude-device__row">
            <input className="dash-input" readOnly value={link?.url ?? ''} aria-label="Exclude-device link" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="dash-btn-secondary" onClick={() => void copy()} disabled={expired}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <div className="dash-exclude-device__foot">
            <span className="dash-exclude-device__timer" aria-live="polite">
              {expired ? 'This link expired.' : <>Works for <span className="mr-num">{link ? remaining(link.expiresAt, now) : ''}</span></>}
            </span>
            <span className="dash-exclude-device__actions">
              <button type="button" className="dash-link-button" onClick={() => void mint()} disabled={busy}>New link</button>
              <button type="button" className="dash-link-button" onClick={() => setOpen(false)}>Done</button>
            </span>
          </div>
        </div>
      )}
      {error && <p className="dash-inline-error" role="alert">{error}</p>}
    </div>
  );
}
