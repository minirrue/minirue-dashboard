import type { GalleryItem, GalleryItemStatus } from './types';

/**
 * Every file type a gallery upload input offers.
 *
 * Videos: what backend#123 accepts and converts to H.264 MP4 in the
 * background. The bare extensions are there on purpose — Windows browsers
 * often report no MIME type at all for .mkv/.avi/.flv, and an `accept` list of
 * MIME types alone hides those files in the picker.
 */
export const GALLERY_UPLOAD_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/x-msvideo',
  'video/x-flv',
  'video/ogg',
  'video/mpeg',
  'video/mp2t',
  'video/3gpp',
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.webm',
  '.ogv',
  '.flv',
  '.mpg',
  '.mpeg',
  '.ts',
  '.mts',
  '.m2ts',
  '.3gp',
  '.wmv',
].join(',');

/** The upload help line, wherever a gallery upload offers video. */
export const GALLERY_VIDEO_UPLOAD_HINT =
  'Videos: most formats (converted to MP4 after upload), up to 50 MB and 120 seconds.';

/** Absent (an API older than backend#123) reads as `ready`. */
export function galleryItemStatus(item: Pick<GalleryItem, 'status'>): GalleryItemStatus {
  return item.status ?? 'ready';
}

/**
 * True when `item.url` can be handed to a `<video>` as-is. An image is always
 * "playable" in this sense; only a video can be mid-conversion.
 */
export function isPlayableGalleryItem(item: Pick<GalleryItem, 'status'>): boolean {
  return galleryItemStatus(item) === 'ready';
}

/** Shown on a failed item when the server gave no reason. */
export const FAILED_FALLBACK_MESSAGE = 'This video could not be converted.';
