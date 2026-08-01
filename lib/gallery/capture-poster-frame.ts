/**
 * Grab one frame off a locally-picked video and hand it back as a poster
 * image, entirely client-side.
 *
 * A port of the storefront's `lib/media/capture-poster-frame.ts`, kept
 * character-for-character in behaviour so a gallery video and a review video
 * produce the same kind of thumbnail. The two apps share no code, so this is
 * a copy on purpose rather than a package.
 *
 * There is no ffmpeg (or any server-side video decoder) in this project's
 * dependencies, and adding one just to pull a single frame out of a clip
 * would be a heavy dependency for a thumbnail. The browser that is about to
 * decode this exact file for the local `<video>` preview anyway can draw the
 * same frame onto a `<canvas>` for free — see `GalleryService.storePoster` on
 * the backend, which re-encodes whatever this produces through the same
 * rotate()+webp() pipeline as a gallery photo.
 *
 * Never throws: a poster is a nice-to-have thumbnail, not the upload. A video
 * whose poster capture fails (a format quirk, a very short clip, a browser
 * that refuses `HTMLVideoElement.seeked` for some reason) still uploads and
 * still plays — it just falls back to the browser's own default first frame,
 * exactly like it did before this existed.
 */

const CAPTURE_AT_SECONDS = 0.1;
const OUTPUT_QUALITY = 0.85;

export async function capturePosterFrame(file: File): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  if (!file.type.startsWith('video/')) return null;

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = objectUrl;

  try {
    await waitFor(video, 'loadedmetadata');

    // Duration can be 0/NaN for some containers until more data arrives —
    // clamp rather than seek past the end and stall forever.
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const seekTo = Math.min(CAPTURE_AT_SECONDS, duration / 2);

    const seeked = waitFor(video, 'seeked');
    video.currentTime = seekTo;
    await seeked;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 180;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0 || canvas.height === 0) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', OUTPUT_QUALITY);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * The one thing callers actually need: the `poster` part for an upload's
 * FormData, or null when there is nothing to attach. Keeps every upload site
 * from repeating the "is it a video / did the capture work / what filename"
 * dance.
 */
export async function posterPartFor(file: File): Promise<File | null> {
  const blob = await capturePosterFrame(file);
  if (!blob) return null;
  return new File([blob], 'poster.jpg', { type: 'image/jpeg' });
}

function waitFor(video: HTMLVideoElement, event: 'loadedmetadata' | 'seeked'): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`video failed before "${event}"`));
    };
    const cleanup = () => {
      video.removeEventListener(event, onEvent);
      video.removeEventListener('error', onError);
    };
    video.addEventListener(event, onEvent, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}
