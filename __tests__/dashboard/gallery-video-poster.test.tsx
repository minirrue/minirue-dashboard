import { describe, expect, it, beforeEach } from '@jest/globals';

/**
 * Owner ask 2026-08-01: an uploaded video should get a thumbnail the same way
 * the storefront's account photo does, instead of a grid of black boxes.
 *
 * A gallery video row had no poster at all (migration 0190 adds the column),
 * so every surface rendered a bare `<video src>` and the browser had to fetch
 * and decode the clip itself just to paint one frame — seconds of empty tile
 * per item, which reads as "the upload did not work". The poster is grabbed
 * client-side at pick time and attached to the SAME multipart request, so
 * there is no second round trip and nothing to wait for after the upload.
 *
 * Attached inside `uploadItem`/`exchangeItem` rather than at each call site
 * precisely so this holds for every route into the gallery — that is what
 * this test pins.
 */
jest.mock('@/lib/api/client', () => ({
  apiFetch: jest.fn(),
  apiUpload: jest.fn().mockResolvedValue({ id: 'item-1' }),
}));

const mockCapture = jest.fn();
jest.mock('@/lib/gallery/capture-poster-frame', () => ({
  posterPartFor: (file: File) => mockCapture(file),
}));

import { apiUpload } from '@/lib/api/client';
import { uploadItem, exchangeItem } from '@/lib/gallery/api';

const posterFile = () => new File(['poster-bytes'], 'poster.jpg', { type: 'image/jpeg' });
const videoFile = () => new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' });
const imageFile = () => new File(['image-bytes'], 'photo.webp', { type: 'image/webp' });

function sentForm(): FormData {
  const call = (apiUpload as jest.Mock).mock.calls[0];
  return call[1] as FormData;
}

describe('gallery upload attaches a video poster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiUpload as jest.Mock).mockResolvedValue({ id: 'item-1' });
  });

  it('sends the captured frame as a `poster` part alongside the video', async () => {
    mockCapture.mockResolvedValue(posterFile());

    await uploadItem('folder-1', videoFile());

    const form = sentForm();
    expect(form.get('file')).toBeInstanceOf(File);
    expect(form.get('poster')).toBeInstanceOf(File);
    expect((form.get('poster') as File).type).toBe('image/jpeg');
  });

  it('sends no `poster` part for an image', async () => {
    // posterPartFor returns null for anything that is not a video.
    mockCapture.mockResolvedValue(null);

    await uploadItem('folder-1', imageFile());

    expect(sentForm().get('poster')).toBeNull();
  });

  it('still uploads the video when the capture fails', async () => {
    mockCapture.mockResolvedValue(null);

    await expect(uploadItem('folder-1', videoFile())).resolves.toBeDefined();

    const form = sentForm();
    expect(form.get('file')).toBeInstanceOf(File);
    expect(form.get('poster')).toBeNull();
  });

  it('attaches a fresh poster on exchange too, since the bytes changed', async () => {
    mockCapture.mockResolvedValue(posterFile());

    await exchangeItem('item-1', videoFile());

    expect(sentForm().get('poster')).toBeInstanceOf(File);
    // PATCH, not POST — the item keeps its id (see exchangeItem's doc comment).
    expect((apiUpload as jest.Mock).mock.calls[0][2]).toBe('PATCH');
  });
});
