'use client';

import React from 'react';

/**
 * Task 10 (2026-07-30) — stop freshly-uploaded images rendering broken.
 *
 * Root cause, established: the client renders the exact, fully-signed, final
 * URL the server itself would return on a later GET — byte-identical.
 * Nothing is wrong with the address. What is wrong is that the request fired
 * immediately after an upload is, by construction, the first-ever request for
 * that URL: a guaranteed cold miss that must traverse Cloudflare -> nginx ->
 * imgproxy -> Garage, decode a full-resolution WebP q95 master, resize, and
 * encode. That first request is uniquely slow and uniquely fragile, and there
 * was not a single `onError` handler on any `<img>` in either app and no
 * refetch after any upload — so one transient failure froze the page broken
 * until a manual reload.
 *
 * This is a thin `<img>` wrapper: on `error`, it waits `600ms x 2^attempt`
 * (capped at `maxAttempts`), then re-sets `src` with a cache-busting
 * `&retry=N` suffix. The imgproxy nginx cache key in production is
 * `"$scheme$host$uri$handle_webp"` — no query string — so `&retry=N` busts
 * the BROWSER's cache without fragmenting the CDN's; the retry re-asks for
 * the same cacheable object. After the last attempt it shows a small
 * "Couldn't load — tap to retry" affordance that resets the attempt counter.
 */

const BASE_RETRY_DELAY_MS = 600;
const DEFAULT_MAX_ATTEMPTS = 3;

function withRetryParam(src: string, attempt: number): string {
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}retry=${attempt}`;
}

export interface RetryingImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'src'> {
  src: string;
  alt: string;
  /** Total attempts allowed (the original request plus retries) before
   *  giving up and showing the retry affordance. Defaults to 3. */
  maxAttempts?: number;
}

export default function RetryingImage({
  src,
  alt,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  style,
  className,
  ...rest
}: RetryingImageProps) {
  const [renderedSrc, setRenderedSrc] = React.useState(src);
  const [failed, setFailed] = React.useState(false);
  // Counts failures synchronously, independent of whether a scheduled retry
  // has actually re-rendered `src` yet — two `error` events can land back to
  // back (a fast test, or a genuinely fast double-failure) before the first
  // backoff timer fires, and both must still count.
  const attemptsRef = React.useRef(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new `src` prop (a different image entirely) resets everything.
  React.useEffect(() => {
    attemptsRef.current = 0;
    setRenderedSrc(src);
    setFailed(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [src]);

  React.useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  function scheduleRetry(attempt: number) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const delay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
    timeoutRef.current = setTimeout(() => {
      setRenderedSrc(withRetryParam(src, attempt));
    }, delay);
  }

  function handleError() {
    const attempt = attemptsRef.current + 1;
    attemptsRef.current = attempt;
    if (attempt >= maxAttempts) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setFailed(true);
      return;
    }
    scheduleRetry(attempt);
  }

  function handleRetryTap() {
    attemptsRef.current = 0;
    setFailed(false);
    setRenderedSrc(src);
  }

  if (failed) {
    // Not a real `<button>`: several call sites (the enlarge/preview
    // controls in MediaSection, GalleryClient and GalleryPickerModal) already
    // wrap this component in their OWN `<button>`, and a `<button>` inside a
    // `<button>` is invalid HTML. `role="button"` + a key handler keeps this
    // keyboard-operable without that nesting problem.
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleRetryTap}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRetryTap();
          }
        }}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 4,
          border: '1px dashed var(--mr-dash-hair, #ccc)',
          background: 'var(--mr-dash-sub, #f4f1ec)',
          color: 'var(--mr-dash-fg-3, #6b6459)',
          fontSize: 11,
          lineHeight: 1.3,
          cursor: 'pointer',
          ...style,
        }}
      >
        Couldn&apos;t load — tap to retry
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={renderedSrc}
      alt={alt}
      className={className}
      style={style}
      onError={handleError}
      {...rest}
    />
  );
}
