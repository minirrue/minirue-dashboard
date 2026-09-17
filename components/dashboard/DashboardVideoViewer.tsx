'use client';

import React, { useEffect, useRef, useState } from 'react';
import RetryingImage from './RetryingImage';
import { galleryItemFailureMessage, NotReadyVideoStill } from './GalleryItemStatus';
import { galleryItemStatus } from '@/lib/gallery/status';
import type { GalleryItemStatus } from '@/lib/gallery/types';

export interface DashboardVideoSource {
  url?: string | null;
  posterUrl?: string | null;
  status?: GalleryItemStatus;
  processingError?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  originalFilename?: string | null;
}

interface Props {
  media: DashboardVideoSource;
  variant?: 'player' | 'thumbnail';
  autoPlay?: boolean;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  preferPoster?: boolean;
  showStatusBadge?: boolean;
  onExchange?: () => void;
  onDelete?: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function PlayIcon({ paused }: { paused: boolean }) {
  return paused ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor" /></svg>
  );
}

/** The only dashboard component allowed to render a video element. */
export default function DashboardVideoViewer({
  media,
  variant = 'player',
  autoPlay = false,
  className,
  style,
  label = 'Video preview',
  preferPoster = false,
  showStatusBadge = true,
  onExchange,
  onDelete,
}: Props) {
  const status = galleryItemStatus(media);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(media.durationSeconds ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!autoPlay || status !== 'ready' || variant !== 'player') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) void videoRef.current?.play().catch(() => setPlaying(false));
  }, [autoPlay, status, variant, media.url]);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setFailedSource(media.url ?? ''));
    else video.pause();
  }

  function seek(delta: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || duration, video.currentTime + delta));
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await frameRef.current?.requestFullscreen?.();
  }

  function handleKeyboard(event: React.KeyboardEvent) {
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    const key = event.key.toLowerCase();
    if (key === ' ') { event.preventDefault(); togglePlayback(); }
    else if (key === 'arrowleft') { event.preventDefault(); seek(-5); }
    else if (key === 'arrowright') { event.preventDefault(); seek(5); }
    else if (key === 'm') toggleMute();
    else if (key === 'f') void toggleFullscreen();
  }

  if (variant === 'thumbnail') {
    const ready = status === 'ready' && Boolean(media.url);
    return (
      <span className={['dash-video-thumb', className].filter(Boolean).join(' ')} style={style} data-video-state={status}>
        {status !== 'ready' ? (
          <NotReadyVideoStill item={{ posterUrl: media.posterUrl ?? null, status }} className="dash-video-thumb-media" />
        ) : ready && preferPoster && media.posterUrl ? (
          <RetryingImage src={media.posterUrl} alt="" className="dash-video-thumb-media" />
        ) : ready ? (
          <video ref={videoRef} src={media.url ?? undefined} poster={media.posterUrl ?? undefined} muted playsInline preload={media.posterUrl ? 'none' : 'metadata'} className="dash-video-thumb-media" aria-label={label} />
        ) : (
          <NotReadyVideoStill item={{ posterUrl: null, status: 'failed' }} className="dash-video-thumb-media" />
        )}
        {(ready || Boolean(media.posterUrl)) && <span className="dash-video-thumb-play" data-media-play aria-hidden="true"><PlayIcon paused /></span>}
        {status !== 'ready' && showStatusBadge && <span className="dash-video-state-badge">{status === 'processing' ? 'Converting…' : 'Failed'}</span>}
        {status === 'ready' && <span className="dash-sr-only">Video</span>}
      </span>
    );
  }

  if (status !== 'ready') {
    const failed = status === 'failed';
    return (
      <section className={['dash-video-viewer', className].filter(Boolean).join(' ')} style={style} data-video-state={status} aria-label={`${label} player`}>
        <div className="dash-video-stage dash-video-stage-static">
          <NotReadyVideoStill item={{ posterUrl: media.posterUrl ?? null, status }} className="dash-video-poster" />
          <div className="dash-video-state-panel" role={failed ? 'alert' : 'status'}>
            {!failed && <span className="dash-video-spinner" aria-hidden="true" />}
            <strong>{failed ? 'Conversion failed' : 'Converting video'}</strong>
            <span>{failed ? galleryItemFailureMessage(media) : 'This preview will update automatically when the MP4 is ready.'}</span>
            {failed && (onExchange || onDelete) && (
              <span className="dash-video-state-actions">
                {onExchange && <button type="button" className="dash-video-action-primary" onClick={onExchange}>Exchange</button>}
                {onDelete && <button type="button" className="dash-video-action-danger" onClick={onDelete}>Delete</button>}
              </span>
            )}
          </div>
        </div>
      </section>
    );
  }

  const facts = [
    duration > 0 ? formatTime(duration) : null,
    media.width && media.height ? `${media.width} × ${media.height}` : null,
    media.mimeType ? media.mimeType.replace('video/', '').toUpperCase() : null,
    typeof media.sizeBytes === 'number' ? formatBytes(media.sizeBytes) : null,
    media.originalFilename?.toLowerCase().endsWith('.mov') ? 'Converted from .mov' : null,
  ].filter(Boolean);
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const sourceError = failedSource === (media.url ?? '');

  return (
    <section className={['dash-video-viewer', className].filter(Boolean).join(' ')} style={style} data-video-state={sourceError ? 'error' : buffering ? 'buffering' : 'ready'} aria-label={`${label} player`}>
      <div ref={frameRef} className="dash-video-stage" tabIndex={0} onKeyDown={handleKeyboard}>
        <video
          ref={videoRef}
          src={media.url ?? undefined}
          poster={media.posterUrl ?? undefined}
          playsInline
          preload="metadata"
          aria-label={label}
          onClick={togglePlayback}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => { setPlaying(true); setBuffering(false); }}
          onCanPlay={() => setBuffering(false)}
          onError={() => { setFailedSource(media.url ?? ''); setBuffering(false); }}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || media.durationSeconds || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onProgress={(event) => {
            const video = event.currentTarget;
            if (video.buffered.length && video.duration) setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
          }}
          onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        />
        {buffering && <span className="dash-video-spinner dash-video-spinner-overlay" role="status"><span className="dash-sr-only">Buffering video</span></span>}
        {sourceError && (
          <div className="dash-video-source-error" role="alert">
            <strong>Video unavailable</strong>
            <span>The source could not be loaded. Check the file or exchange it.</span>
            {onExchange && <button type="button" onClick={onExchange}>Exchange video</button>}
          </div>
        )}
        {!sourceError && (
          <div className="dash-video-controls">
            <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}><PlayIcon paused={!playing} /></button>
            <span className="dash-video-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <label className="dash-video-scrubber">
              <span className="dash-sr-only">Video position</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (videoRef.current) videoRef.current.currentTime = next;
                  setCurrentTime(next);
                }}
                style={{ '--video-progress': `${progress}%`, '--video-buffered': `${buffered}%` } as React.CSSProperties}
              />
            </label>
            <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute video' : 'Mute video'}>{muted ? 'Muted' : 'Sound'}</button>
            <button type="button" onClick={() => void toggleFullscreen()} aria-label="Toggle fullscreen">Full</button>
          </div>
        )}
      </div>
      {facts.length > 0 && <p className="dash-video-facts" aria-label="Video details">{facts.map((fact) => <span key={fact}>{fact}</span>)}</p>}
    </section>
  );
}
