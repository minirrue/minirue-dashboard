'use client';

import React from 'react';
import RetryingImage, { type RetryingImageProps } from './RetryingImage';

/**
 * Task FF (2026-07-30) — stop a freshly uploaded image ever showing broken,
 * not just recovering quickly.
 *
 * `RetryingImage` (this file's sibling) fixed the "frozen broken forever"
 * failure mode, but it still shows a broken frame FIRST and recovers a beat
 * later — for an image the browser is holding the exact bytes of already,
 * that first broken flash is pure own-goal. The request that follows an
 * upload is a guaranteed-cold cache miss through Cloudflare -> nginx ->
 * imgproxy -> Garage; there is no reason to make the user wait on that round
 * trip to see their own photo when it is sitting in memory as a File/Blob.
 *
 * `UploadPreviewImage` renders that local File/Blob (via an object URL it
 * owns end to end) instead of the remote `src` for as long as the remote
 * copy is unconfirmed, then swaps over once a background probe confirms the
 * remote URL actually loads — using the same backoff `RetryingImage` uses,
 * so a cold miss on the FIRST probe still resolves without a page reload.
 * If the remote copy never loads, the user simply keeps seeing their own
 * picture — never a broken icon.
 *
 * When `localFile` is omitted (the normal case for a gallery/listing view on
 * first paint, where no local bytes exist), this is a pure passthrough to
 * `RetryingImage` — identical behaviour to before.
 *
 * Object URL lifecycle is owned entirely inside this component so callers
 * cannot reproduce the WriteReviewSheet leak (an effect registered with `[]`
 * deps that closes over the first render's value and revokes nothing on
 * every subsequent file). The effect below depends on `localFile` itself, so
 * each new file gets a fresh URL and the PREVIOUS one is revoked by that same
 * effect's own cleanup — never a stale closure.
 */

const PROBE_BASE_DELAY_MS = 600;
const PROBE_MAX_ATTEMPTS = 5;

export interface UploadPreviewImageProps extends Omit<RetryingImageProps, 'src'> {
  /** The final remote URL — what the server will return for this image on
   *  every later request. */
  src: string;
  /** Bytes already in the browser for THIS image — the File/Blob that was
   *  just picked or cropped, whose upload `src` is the eventual result of.
   *  Omit for images that were not just uploaded in this session (e.g. an
   *  existing gallery listing on first paint), where no local bytes exist
   *  and plain retry behaviour is correct. */
  localFile?: File | Blob | null;
}

export default function UploadPreviewImage({
  src,
  localFile,
  alt,
  ...rest
}: UploadPreviewImageProps) {
  const [localUrl, setLocalUrl] = React.useState<string | null>(null);
  const [remoteReady, setRemoteReady] = React.useState(false);

  // Own the object URL end to end: a fresh URL per `localFile`, revoked when
  // replaced or on unmount.
  React.useEffect(() => {
    if (!localFile) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(localFile);
    setLocalUrl(url);
    setRemoteReady(false);
    return () => URL.revokeObjectURL(url);
  }, [localFile]);

  // Background-probe the remote URL with the same backoff RetryingImage
  // uses. Only once this probe succeeds do we trust `src` enough to show it
  // (and to free the local object URL) — swapping on a bare `<img src>`
  // change would show the SAME broken flash this component exists to avoid.
  React.useEffect(() => {
    if (!localUrl) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function attempt(n: number) {
      const probe = new window.Image();
      probe.onload = () => {
        if (!cancelled) setRemoteReady(true);
      };
      probe.onerror = () => {
        if (cancelled || n + 1 >= PROBE_MAX_ATTEMPTS) return;
        timeoutId = setTimeout(() => attempt(n + 1), PROBE_BASE_DELAY_MS * 2 ** n);
      };
      probe.src = src;
    }
    attempt(0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [src, localUrl]);

  // Free the local URL as soon as the remote copy is confirmed — no reason
  // to hold the memory once it is no longer being shown.
  React.useEffect(() => {
    if (remoteReady && localUrl) {
      URL.revokeObjectURL(localUrl);
      setLocalUrl(null);
    }
  }, [remoteReady, localUrl]);

  if (localUrl && !remoteReady) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={localUrl} alt={alt} {...rest} />
    );
  }

  return <RetryingImage src={src} alt={alt} {...rest} />;
}
