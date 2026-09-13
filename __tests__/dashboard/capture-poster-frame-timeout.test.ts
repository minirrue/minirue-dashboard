import { capturePosterFrame, POSTER_CAPTURE_TIMEOUT_MS } from '@/lib/gallery/capture-poster-frame';

/**
 * dashboard#45, point 7: the browser cannot decode most of the formats the
 * backend now converts (.avi, .mkv, ProRes .mov...). The server makes a poster
 * when none is sent, so a failed capture is fine — but a capture that NEVER
 * settles would hold the upload forever, because `uploadItem` awaits it before
 * sending anything. A decoder that fires neither `loadedmetadata` nor `error`
 * must not block the upload.
 */

describe('capturePosterFrame', () => {
  const realCreate = URL.createObjectURL;
  const realRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    jest.useFakeTimers();
    URL.createObjectURL = jest.fn(() => 'blob:clip');
    URL.revokeObjectURL = jest.fn();
  });
  afterEach(() => {
    jest.useRealTimers();
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
  });

  it('gives up and resolves null when the video never loads', async () => {
    // jsdom's <video> never loads anything and never errors — exactly the hang.
    const file = new File(['not-decodable'], 'clip.avi', { type: 'video/x-msvideo' });
    let settled: Blob | null | 'pending' = 'pending';
    const p = capturePosterFrame(file).then((r) => {
      settled = r;
    });

    await jest.advanceTimersByTimeAsync(POSTER_CAPTURE_TIMEOUT_MS - 1);
    expect(settled).toBe('pending');
    await jest.advanceTimersByTimeAsync(1);
    await p;
    expect(settled).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:clip');
  });

  it('does not try to decode a file the browser gave no video type (e.g. .mkv on Windows)', async () => {
    const file = new File(['bytes'], 'clip.mkv', { type: '' });
    await expect(capturePosterFrame(file)).resolves.toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
