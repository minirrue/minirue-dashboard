import { galleryItemStatus } from './status';
import type { GalleryItemStatus } from './types';

/**
 * dashboard#55 — what `DashboardVideoViewer` is given about a video, and the
 * facts an admin reads under it.
 *
 * Only `url` is required, so a gallery item, a product media row and a review
 * attachment all fit. `sizeBytes` and `convertedFrom` are not in any API
 * response yet (the backend overwrites `mimeType` with `video/mp4` when it
 * converts): callers pass them when they know them, e.g. the bytes of a file
 * uploaded this session.
 */
export interface ViewerVideo {
  /** A gallery item id. With it, a converting video can be polled. */
  id?: string;
  url?: string | null;
  posterUrl?: string | null;
  status?: GalleryItemStatus;
  processingError?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
  /** The type the upload had before conversion — a MIME type or extension. */
  convertedFrom?: string | null;
}

/** What the loaded file reports about itself; wins over the stored values. */
export interface MeasuredVideo {
  duration?: number;
  width?: number;
  height?: number;
}

export interface VideoFact {
  label: string;
  value: string;
}

/** 64 → "1:04", 3725 → "1:02:05". Anything not a finite number → "0:00". */
export function formatVideoTime(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const TYPE_NAMES: Record<string, string> = {
  'video/mp4': 'MP4',
  'video/quicktime': 'MOV',
  'video/webm': 'WEBM',
  'video/x-matroska': 'MKV',
  'video/x-msvideo': 'AVI',
  'video/x-flv': 'FLV',
  'video/ogg': 'OGV',
  'video/mpeg': 'MPEG',
  'video/mp2t': 'TS',
  'video/3gpp': '3GP',
  'video/x-ms-wmv': 'WMV',
};

/** "video/quicktime" or ".mov" → "MOV". */
export function videoTypeName(type: string | null | undefined): string | null {
  const t = type?.trim().toLowerCase();
  if (!t) return null;
  if (TYPE_NAMES[t]) return TYPE_NAMES[t];
  if (t.startsWith('.')) return t.slice(1).toUpperCase();
  const sub = t.split('/')[1];
  return sub ? sub.replace(/^x-/, '').toUpperCase() : t.toUpperCase();
}

/** 4_400_000 → "4.2 MB" (binary units, as a file manager shows them). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function videoFacts(video: ViewerVideo, measured: MeasuredVideo = {}): VideoFact[] {
  const facts: VideoFact[] = [];
  const ready = galleryItemStatus(video) === 'ready';

  const duration = measured.duration || video.durationSeconds;
  if (duration && Number.isFinite(duration)) {
    facts.push({ label: 'Duration', value: formatVideoTime(duration) });
  }
  const width = measured.width || video.width;
  const height = measured.height || video.height;
  if (width && height) facts.push({ label: 'Dimensions', value: `${width} × ${height}` });

  const type = videoTypeName(video.mimeType);
  if (type) {
    // While not ready, `mimeType` is the original upload's.
    const value =
      !ready && galleryItemStatus(video) === 'processing' && type !== 'MP4'
        ? `${type}, converting to MP4`
        : type;
    facts.push({ label: 'Type', value });
  }
  if (video.sizeBytes && video.sizeBytes > 0) {
    facts.push({ label: 'Size', value: formatBytes(video.sizeBytes) });
  }
  const from = videoTypeName(video.convertedFrom);
  if (ready && from && from !== type) facts.push({ label: 'Converted from', value: from });
  return facts;
}
