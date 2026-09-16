'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import RetryingImage from './RetryingImage';
import { GalleryItemStatusBadge, galleryItemFailureMessage } from './GalleryItemStatus';
import { galleryItemStatus } from '@/lib/gallery/status';
import { useProcessingItemsPoll } from '@/lib/gallery/use-processing-poll';
import {
  formatVideoTime,
  videoFacts,
  type MeasuredVideo,
  type ViewerVideo,
} from '@/lib/gallery/video-facts';
import type { GalleryItem } from '@/lib/gallery/types';

/**
 * dashboard#55 — the one video viewer in the dashboard.
 *
 * Every place an admin previews a video renders it through this file: the full
 * viewer (`DashboardVideoViewer`), a muted thumbnail frame (`VideoStill`), or
 * the viewer in a dialog (`VideoLightbox`). A guard test fails if a `<video>`
 * appears anywhere else.
 *
 * Why a small component on `<video>` and not a player library (research,
 * 2026-09-14, esbuild min+gzip with React external): media-chrome 4.19 is
 * 44.8 KB, Vidstack 1.15 is 97.5 KB, Plyr 3.8 is 32.8 KB plus 5.1 KB of CSS.
 * All three are being merged into Video.js v10, which is still a release
 * candidate. We only play server-converted H.264 MP4, and the states that
 * matter here (Converting, Failed with Exchange/Delete) are ours anyway.
 *
 * States: ready (custom controls, keyboard), buffering (spinner), converting
 * (poster, badge, polls until ready and then plays the MP4), failed (poster,
 * reason, Exchange/Delete), and source error (a message, never a black box).
 */

export type { ViewerVideo } from '@/lib/gallery/video-facts';

const SEEK_STEP_SECONDS = 5;
const IDLE_HIDE_MS = 2500;

/* ── Icons: one 24px grid, filled glyphs for transport, 2px strokes for the rest ── */
function Icon({ children, size = 20 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};
const PlayIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path
      d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.2-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6z"
      fill="currentColor"
    />
  </Icon>
);
const PauseIcon = () => (
  <Icon>
    <rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor" />
    <rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor" />
  </Icon>
);
const SpeakerShape = () => (
  <path
    d="M4 9.5h3l4.4-3.6a.8.8 0 0 1 1.3.62v10.96a.8.8 0 0 1-1.3.62L7 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"
    fill="currentColor"
  />
);
const VolumeIcon = () => (
  <Icon>
    <SpeakerShape />
    <path d="M16 9.2a4 4 0 0 1 0 5.6M18.6 6.6a7.6 7.6 0 0 1 0 10.8" {...stroke} />
  </Icon>
);
const MutedIcon = () => (
  <Icon>
    <SpeakerShape />
    <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" {...stroke} />
  </Icon>
);
const EnterFullscreenIcon = () => (
  <Icon>
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" {...stroke} />
  </Icon>
);
const ExitFullscreenIcon = () => (
  <Icon>
    <path d="M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4" {...stroke} />
  </Icon>
);
const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" {...stroke} />
  </Icon>
);

/* ── Media errors, in the admin's words ── */
function sourceErrorMessage(code: number | null): string {
  switch (code) {
    case 2: // MEDIA_ERR_NETWORK
      return "The video couldn't be downloaded. Check the connection and try again.";
    case 3: // MEDIA_ERR_DECODE
      return "This file is damaged or uses a codec this browser can't decode. Exchange it for an MP4.";
    default: // MEDIA_ERR_SRC_NOT_SUPPORTED, or the file is missing
      return "This browser can't play this file. Exchange it for an MP4 (H.264), or try another browser.";
  }
}

type FullscreenCapable = HTMLElement & { webkitRequestFullscreen?: () => void };
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/* ── The player for a ready video ── */
function ReadyPlayer({
  video,
  label,
  autoPlay,
  compact,
  startMuted,
  onMeasured,
}: {
  video: ViewerVideo & { url: string };
  label: string;
  autoPlay: boolean;
  compact: boolean;
  startMuted: boolean;
  onMeasured: (m: MeasuredVideo) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [muted, setMuted] = useState(startMuted);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  const total = duration || video.durationSeconds || 0;

  const play = useCallback(() => {
    const v = mediaRef.current;
    if (!v) return;
    // A refused autoplay or an interrupted load rejects; the button stays "Play".
    void v.play()?.catch(() => {});
  }, []);

  const togglePlay = useCallback(() => {
    const v = mediaRef.current;
    if (!v) return;
    if (playing) v.pause();
    else play();
  }, [playing, play]);

  const seekTo = useCallback(
    (t: number) => {
      const v = mediaRef.current;
      if (!v) return;
      const max = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : total;
      const next = Math.max(0, max > 0 ? Math.min(t, max) : t);
      v.currentTime = next;
      setCurrent(next);
    },
    [total],
  );

  const toggleMute = useCallback(() => {
    const v = mediaRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current as FullscreenCapable | null;
    if (!root) return;
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen?.();
      return;
    }
    if (root.requestFullscreen) void root.requestFullscreen().catch(() => {});
    else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
    // iPhone Safari only lets the <video> itself go full screen.
    else (mediaRef.current as IosVideo | null)?.webkitEnterFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (autoPlay) play();
  }, [autoPlay, play]);

  useEffect(() => () => clearTimeout(idleTimer.current), []);

  function wake() {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_HIDE_MS);
  }

  function readBuffered(v: HTMLVideoElement) {
    const ranges = v.buffered;
    if (!ranges || ranges.length === 0) return;
    let end = ranges.end(ranges.length - 1);
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= v.currentTime && v.currentTime <= ranges.end(i)) {
        end = ranges.end(i);
        break;
      }
    }
    setBufferedEnd(end);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    const onButton = target !== e.currentTarget && target.tagName === 'BUTTON';
    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        // A focused button already answers space with its own click.
        if (onButton) return;
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight':
        e.preventDefault();
        seekTo((mediaRef.current?.currentTime ?? current) + SEEK_STEP_SECONDS);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seekTo((mediaRef.current?.currentTime ?? current) - SEEK_STEP_SECONDS);
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        toggleMute();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      default:
        return;
    }
    wake();
  }

  const pct = (t: number) => (total > 0 ? `${Math.round(Math.min(t / total, 1) * 1000) / 10}%` : '0%');
  const timeText = `${formatVideoTime(current)} / ${formatVideoTime(total)}`;

  return (
    <div
      ref={rootRef}
      className="dash-vv-stage"
      role="group"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={wake}
      data-playing={playing ? 'true' : undefined}
      data-idle={idle ? 'true' : undefined}
      data-fullscreen={fullscreen ? 'true' : undefined}
      data-size={compact ? 'compact' : undefined}
    >
      <video
        ref={mediaRef}
        className="dash-vv-media"
        src={video.url}
        poster={video.posterUrl ?? undefined}
        preload="metadata"
        muted={startMuted}
        playsInline
        disablePictureInPicture
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          setErrorCode(null);
          wake();
        }}
        onPause={() => {
          setPlaying(false);
          setBuffering(false);
          setIdle(false);
        }}
        onEnded={() => {
          setPlaying(false);
          setIdle(false);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onSeeked={() => setBuffering(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (Number.isFinite(v.duration)) setDuration(v.duration);
          setMuted(v.muted);
          onMeasured({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          setCurrent(e.currentTarget.currentTime);
          readBuffered(e.currentTarget);
        }}
        onProgress={(e) => readBuffered(e.currentTarget)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onError={(e) => {
          setErrorCode(e.currentTarget.error?.code ?? 4);
          setBuffering(false);
          setPlaying(false);
        }}
      />

      {!started && errorCode == null && (
        <button
          type="button"
          className="dash-vv-bigplay"
          onClick={play}
          aria-label="Play"
        >
          <PlayIcon size={compact ? 20 : 28} />
        </button>
      )}

      {buffering && errorCode == null && (
        <div className="dash-vv-spinner-wrap" role="status">
          <span className="dash-vv-spinner" aria-hidden="true" />
          <span className="dash-sr-only">Loading video</span>
        </div>
      )}

      {errorCode != null ? (
        <div className="dash-vv-notice" role="alert" data-tone="error">
          <p className="dash-vv-notice-title">Can&rsquo;t play this video</p>
          <p className={compact ? 'dash-sr-only' : 'dash-vv-notice-body'}>
            {sourceErrorMessage(errorCode)}
          </p>
          <div className="dash-vv-actions">
            <button
              type="button"
              className="dash-vv-action"
              onClick={() => {
                setErrorCode(null);
                mediaRef.current?.load();
              }}
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="dash-vv-bar">
          <button
            type="button"
            className="dash-vv-btn"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div
            className="dash-vv-track"
            data-vv-track
            style={
              {
                '--vv-played': pct(current),
                '--vv-buffered': pct(bufferedEnd),
              } as React.CSSProperties
            }
          >
            <input
              type="range"
              className="dash-vv-seek"
              aria-label="Seek"
              min={0}
              max={total || 0}
              step="any"
              value={Math.min(current, total || current)}
              aria-valuetext={`${formatVideoTime(current)} of ${formatVideoTime(total)}`}
              onChange={(e) => seekTo(Number(e.target.value))}
            />
          </div>
          <span className="dash-vv-time" aria-hidden="true">
            {timeText}
          </span>
          <button
            type="button"
            className="dash-vv-btn"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MutedIcon /> : <VolumeIcon />}
          </button>
          <button
            type="button"
            className="dash-vv-btn"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {fullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
          </button>
        </div>
      )}
    </div>
  );
}

export interface DashboardVideoViewerProps {
  video: ViewerVideo;
  /** The accessible name of the player, e.g. the item's alt text. */
  label?: string;
  autoPlay?: boolean;
  /** Start muted, e.g. to preview a clip the storefront plays silently. */
  muted?: boolean;
  /**
   * Poll a converting gallery item (needs `video.id`) and swap to the MP4 when
   * it is ready. Pass `false` where the parent already polls the same item.
   */
  poll?: boolean;
  /** Each fresh read of the item while polling. */
  onUpdate?: (fresh: GalleryItem) => void;
  /** Shown on a failed video. */
  onExchange?: () => void;
  onDelete?: () => void;
  /** `compact` for a small frame: no facts, no paragraphs, controls only. */
  size?: 'full' | 'compact';
  className?: string;
}

export default function DashboardVideoViewer({
  video,
  label = 'Video',
  autoPlay = false,
  muted = false,
  poll = true,
  onUpdate,
  onExchange,
  onDelete,
  size = 'full',
  className,
}: DashboardVideoViewerProps) {
  const [fresh, setFresh] = useState<GalleryItem | null>(null);
  const [measured, setMeasured] = useState<MeasuredVideo>({});

  const live: ViewerVideo =
    fresh && fresh.id === video.id
      ? {
          ...video,
          url: fresh.url,
          posterUrl: fresh.posterUrl,
          status: fresh.status,
          processingError: fresh.processingError,
          mimeType: fresh.mimeType,
          width: fresh.width,
          height: fresh.height,
          durationSeconds: fresh.durationSeconds,
        }
      : video;
  const status = galleryItemStatus(live);
  const compact = size === 'compact';

  useProcessingItemsPoll(poll && live.id ? [{ id: live.id, status }] : [], (items) => {
    const mine = items.find((i) => i.id === live.id);
    if (!mine) return;
    setFresh(mine);
    onUpdate?.(mine);
  });

  const width = measured.width || live.width;
  const height = measured.height || live.height;
  const ratio = width && height ? `${width} / ${height}` : undefined;
  const facts = compact ? [] : videoFacts(live, measured);

  let stage: React.ReactNode;
  if (status !== 'ready') {
    const failed = status === 'failed';
    const title = failed ? 'Conversion failed' : 'Converting to MP4';
    const body = failed
      ? galleryItemFailureMessage(live)
      : 'It will play here as soon as it is ready. This updates on its own.';
    stage = (
      <div className="dash-vv-stage" role="group" aria-label={label} data-status={status}>
        {live.posterUrl && (
          <RetryingImage src={live.posterUrl} alt="" className="dash-vv-media dash-vv-still" />
        )}
        <GalleryItemStatusBadge item={{ status }} />
        {/* A compact frame sits inside an editor that already says why in its
            own words; the badge is enough there. */}
        {!compact && (
        <div className="dash-vv-notice" data-tone={failed ? 'error' : 'progress'}>
          {!failed && <span className="dash-vv-progress" aria-hidden="true" />}
          <p className="dash-vv-notice-title">{title}</p>
          <p className="dash-vv-notice-body">{body}</p>
          {failed && (onExchange || onDelete) && (
            <div className="dash-vv-actions">
              {onExchange && (
                <button type="button" className="dash-vv-action" onClick={onExchange}>
                  Exchange
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="dash-vv-action"
                  data-tone="danger"
                  onClick={onDelete}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    );
  } else if (!live.url) {
    stage = (
      <div className="dash-vv-stage" role="group" aria-label={label} data-status="missing">
        {live.posterUrl && (
          <RetryingImage src={live.posterUrl} alt="" className="dash-vv-media dash-vv-still" />
        )}
        <div className="dash-vv-notice" role="alert" data-tone="error">
          <p className="dash-vv-notice-title">Can&rsquo;t play this video</p>
          <p className={compact ? 'dash-sr-only' : 'dash-vv-notice-body'}>
            There is no video file attached to this item. Exchange it or pick another.
          </p>
        </div>
      </div>
    );
  } else {
    stage = (
      <ReadyPlayer
        key={live.url}
        video={{ ...live, url: live.url }}
        label={label}
        autoPlay={autoPlay}
        compact={compact}
        startMuted={muted}
        onMeasured={setMeasured}
      />
    );
  }

  return (
    <div
      className={['dash-vv', className].filter(Boolean).join(' ')}
      data-size={size}
      style={ratio ? ({ '--vv-ratio': ratio } as React.CSSProperties) : undefined}
    >
      {stage}
      {facts.length > 0 && (
        <ul className="dash-vv-facts" aria-label="Video details">
          {facts.map((f) => (
            <li key={f.label}>
              <span className="dash-vv-fact-label">{f.label}</span>
              <span className="dash-vv-fact-value">{f.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A muted, controls-free frame for a thumbnail tile: "which clip is this",
 * not a player. `preload="none"` when there is a poster, so a grid of tiles
 * never downloads every clip just to paint one frame.
 */
export function VideoStill({
  src,
  poster,
  label,
  className,
  style,
  onError,
}: {
  src: string;
  poster?: string | null;
  /** Leave out when a surrounding element already names the tile. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  onError?: () => void;
}) {
  return (
    <video
      src={src}
      poster={poster ?? undefined}
      muted
      playsInline
      preload={poster ? 'none' : 'metadata'}
      tabIndex={-1}
      disablePictureInPicture
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={style}
      onError={onError}
    />
  );
}

/**
 * The viewer in a dialog, on a light panel so the facts stay readable over the
 * dark backdrop. Escape and a click on the backdrop close it; focus moves into
 * the dialog and returns to where it came from.
 */
export function VideoLightbox({
  title,
  onClose,
  children,
  traceId,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  traceId?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="dash-gallery-preview-overlay dash-vv-lightbox"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      data-trace-id={traceId}
    >
      <div
        ref={panelRef}
        className="dash-vv-lightbox-panel"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dash-vv-lightbox-head">
          <h2 id={headingId} className="dash-vv-lightbox-title">
            {title}
          </h2>
          <button
            type="button"
            className="dash-vv-lightbox-close"
            onClick={onClose}
            aria-label="Close preview"
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
