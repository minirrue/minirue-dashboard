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
 * the same cacheable object.
 *
 * 2026-08-01 — two changes, both about what happens when it does not load
 * fast enough. The owner uploaded a customer avatar from the storefront
 * ("seamless and so beautiful"), then opened the same customer in the
 * dashboard and got a dashed box reading "Couldn't load — tap to retry".
 * Same picture, same storage, same imgproxy: only the component differed.
 *
 *   1. THREE attempts was too few. 600 + 1200ms means the whole budget was
 *      1.8 seconds — and a cold miss here has to cross Cloudflare, nginx,
 *      imgproxy and Garage and re-encode a full-resolution master. Giving up
 *      inside two seconds mostly measures how cold the cache is. Now six
 *      attempts over ~38s, and the retries continue quietly in the
 *      background AFTER the fallback appears, so a slow image still resolves
 *      into place on its own.
 *
 *   2. Error text is not a thumbnail. A staff member reading a customer
 *      record cannot do anything useful with "Couldn't load", and it is
 *      louder on the page than the photo would have been. Callers now pass
 *      a `fallback` — for an avatar, the same GenericAvatarIcon shown when
 *      there is no photo at all — so a slow image degrades to the ordinary
 *      empty state instead of an error. Clicking it still forces a retry;
 *      that affordance is now a tooltip rather than a paragraph.
 */

const BASE_RETRY_DELAY_MS = 600;
/**
 * Six attempts: 0.6 + 1.2 + 2.4 + 4.8 + 9.6 + 19.2 ≈ 38s of patience. Long
 * enough to outlast a cold imgproxy render, short enough that a genuinely
 * missing object is not retried forever.
 */
const DEFAULT_MAX_ATTEMPTS = 6;
/** Individual backoff cap, so the last gaps do not grow to minutes. */
const MAX_RETRY_DELAY_MS = 20_000;

function withRetryParam(src: string, attempt: number): string {
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}retry=${attempt}`;
}

export interface RetryingImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'src'> {
  src: string;
  alt: string;
  /** Total attempts allowed (the original request plus retries) before
   *  falling back. Defaults to 6 (~38s of backoff). */
  maxAttempts?: number;
  /**
   * What to show while the image is still failing — for an avatar, the same
   * generic silhouette used when there is no photo at all.
   *
   * The point is that a slow image should look like an ordinary empty state,
   * not like something has broken. Retries carry on behind it, so this is
   * usually temporary; if the image does eventually arrive it simply
   * replaces this. Omit it and you get a quiet neutral tile — never an error
   * message, which is what this component used to render.
   */
  fallback?: React.ReactNode;
}

export default function RetryingImage({
  src,
  alt,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  fallback,
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
    const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
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
    // Show the fallback from the FIRST failure rather than holding a broken
    // frame for 38 seconds while the retries run. The retries continue
    // underneath, and `handleLoad` swaps the picture back in the moment one
    // of them succeeds — which is what makes a slow image look merely slow
    // instead of broken.
    setFailed(true);
    scheduleRetry(attempt);
  }

  /** A retry landed (or the first load did). The picture wins over the fallback. */
  function handleLoad() {
    setFailed(false);
  }

  function handleRetryTap() {
    attemptsRef.current = 0;
    setFailed(false);
    setRenderedSrc(src);
  }

  // The `<img>` stays MOUNTED while the fallback shows — hidden, not removed.
  // Unmounting it would cancel the retry that is about to succeed, and there
  // would be nothing left to fire `onLoad` when it does. This is the whole
  // trick: the fallback is a cover, not a replacement.
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={renderedSrc}
      alt={alt}
      className={failed ? undefined : className}
      style={
        failed
          ? { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }
          : style
      }
      aria-hidden={failed || undefined}
      onError={handleError}
      onLoad={handleLoad}
      {...rest}
    />
  );

  if (!failed) return image;

  // Not a real `<button>`: several call sites (the enlarge/preview controls
  // in MediaSection, GalleryClient and GalleryPickerModal) already wrap this
  // component in their OWN `<button>`, and a `<button>` inside a `<button>`
  // is invalid HTML. `role="button"` + a key handler keeps this
  // keyboard-operable without that nesting problem.
  //
  // The visible text is gone. It said "Couldn't load — tap to retry" in a
  // dashed box, which is louder than the photograph it replaced and tells a
  // staff member nothing they can act on. The affordance survives as a
  // tooltip and an accessible label.
  return (
    <span
      role="button"
      tabIndex={0}
      title="Image is still loading — click to retry"
      aria-label={alt ? `${alt} (still loading — click to retry)` : 'Retry loading image'}
      onClick={handleRetryTap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRetryTap();
        }
      }}
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'var(--mr-dash-sub, #f4f1ec)',
        color: 'var(--mr-dash-fg-3, #6b6459)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {fallback ?? <NeutralTile />}
      {image}
    </span>
  );
}

/**
 * The default cover: a muted picture glyph. Deliberately wordless — it should
 * read as "no image yet", which is what it means, and never as an error.
 */
function NeutralTile() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="42%"
      height="42%"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ opacity: 0.4 }}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m3 16 4.5-4.5a2 2 0 0 1 2.8 0L15 16" />
      <path d="m14 14 1.6-1.6a2 2 0 0 1 2.8 0L21 15" />
    </svg>
  );
}
