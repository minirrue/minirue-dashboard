import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { GalleryItem } from '@/lib/gallery/types';

/**
 * dashboard#55 — one house-styled video viewer for every place an admin
 * previews a video. The browser's own `<video controls>` chrome is gone; the
 * viewer draws its controls and its states (ready, buffering, converting,
 * failed, source error) itself.
 */

jest.mock('@/lib/gallery/api', () => ({ getItem: jest.fn() }));

import { getItem } from '@/lib/gallery/api';
import { POLL_INITIAL_MS } from '@/lib/gallery/use-processing-poll';
import DashboardVideoViewer from '@/components/dashboard/DashboardVideoViewer';
import { formatVideoTime, videoFacts } from '@/lib/gallery/video-facts';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;

const item = (over: Partial<GalleryItem> = {}): GalleryItem => ({
  id: 'v1',
  folderId: 'f',
  kind: 'video',
  url: 'https://s3.test/v1.mp4',
  posterUrl: 'https://img.test/v1.webp',
  mimeType: 'video/mp4',
  width: 1920,
  height: 1080,
  durationSeconds: 64,
  altText: null,
  createdAt: '2026-09-14T00:00:00.000Z',
  status: 'ready',
  processingError: null,
  ...over,
});

let playSpy: jest.SpyInstance;
let pauseSpy: jest.SpyInstance;
let loadSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  // jsdom implements no media playback; the viewer only needs the calls.
  playSpy = jest
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(function (this: HTMLMediaElement) {
      fireEvent(this, new Event('play'));
      return Promise.resolve();
    });
  pauseSpy = jest
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(function (this: HTMLMediaElement) {
      fireEvent(this, new Event('pause'));
    });
  loadSpy = jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => {
  playSpy.mockRestore();
  pauseSpy.mockRestore();
  loadSpy.mockRestore();
  jest.useRealTimers();
});

function mediaEl(container: HTMLElement): HTMLVideoElement {
  const v = container.querySelector('video');
  if (!v) throw new Error('no <video>');
  return v;
}

function loadMetadata(v: HTMLVideoElement, duration = 64) {
  Object.defineProperty(v, 'duration', { configurable: true, value: duration });
  Object.defineProperty(v, 'videoWidth', { configurable: true, value: 1920 });
  Object.defineProperty(v, 'videoHeight', { configurable: true, value: 1080 });
  fireEvent(v, new Event('loadedmetadata'));
}

describe('formatVideoTime', () => {
  it('reads as m:ss, h:mm:ss past an hour, and 0:00 for nothing', () => {
    expect(formatVideoTime(0)).toBe('0:00');
    expect(formatVideoTime(5.9)).toBe('0:05');
    expect(formatVideoTime(64)).toBe('1:04');
    expect(formatVideoTime(3725)).toBe('1:02:05');
    expect(formatVideoTime(NaN)).toBe('0:00');
    expect(formatVideoTime(Infinity)).toBe('0:00');
  });
});

describe('videoFacts', () => {
  it('lists duration, dimensions, type, size and what it was converted from', () => {
    const facts = videoFacts({
      ...item(),
      sizeBytes: 4_400_000,
      convertedFrom: 'video/quicktime',
    });
    expect(facts).toEqual([
      { label: 'Duration', value: '1:04' },
      { label: 'Dimensions', value: '1920 × 1080' },
      { label: 'Type', value: 'MP4' },
      { label: 'Size', value: '4.2 MB' },
      { label: 'Converted from', value: 'MOV' },
    ]);
  });

  it('says the original is being converted while it is not ready, and leaves out what it does not know', () => {
    expect(
      videoFacts({
        ...item({ status: 'processing', mimeType: 'video/quicktime', width: null, durationSeconds: null }),
      }),
    ).toEqual([{ label: 'Type', value: 'MOV, converting to MP4' }]);
  });
});

describe('DashboardVideoViewer — ready', () => {
  it('draws its own controls: no native chrome, a poster, and a labelled play button', () => {
    const { container } = render(<DashboardVideoViewer video={item()} label="Spring film" />);
    const v = mediaEl(container);
    expect(v).not.toHaveAttribute('controls');
    expect(v).toHaveAttribute('poster', 'https://img.test/v1.webp');
    expect(v).toHaveAttribute('src', 'https://s3.test/v1.mp4');
    expect(screen.getByRole('group', { name: 'Spring film' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Play' }).length).toBeGreaterThan(0);
  });

  it('plays and pauses from the button, and the label follows', () => {
    const { container } = render(<DashboardVideoViewer video={item()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]);
    expect(playSpy).toHaveBeenCalledTimes(1);
    const pause = screen.getByRole('button', { name: 'Pause' });
    fireEvent.click(pause);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(mediaEl(container).paused).toBe(true);
  });

  it('shows current / total time and seeks from the scrubber', () => {
    const { container } = render(<DashboardVideoViewer video={item()} />);
    const v = mediaEl(container);
    loadMetadata(v);
    expect(screen.getByText('0:00 / 1:04')).toBeInTheDocument();
    const seek = screen.getByRole('slider', { name: 'Seek' });
    fireEvent.change(seek, { target: { value: '30' } });
    expect(v.currentTime).toBe(30);
    fireEvent(v, new Event('timeupdate'));
    expect(screen.getByText('0:30 / 1:04')).toBeInTheDocument();
    expect(seek).toHaveAttribute('aria-valuetext', '0:30 of 1:04');
  });

  it('paints the buffered range on the scrubber', () => {
    const { container } = render(<DashboardVideoViewer video={item()} />);
    const v = mediaEl(container);
    loadMetadata(v, 100);
    Object.defineProperty(v, 'buffered', {
      configurable: true,
      value: { length: 1, start: () => 0, end: () => 40 },
    });
    fireEvent(v, new Event('progress'));
    const track = container.querySelector('[data-vv-track]') as HTMLElement;
    expect(track.style.getPropertyValue('--vv-buffered')).toBe('40%');
  });

  it('answers the keyboard: space, ←/→ 5 s, m, f', () => {
    const fullscreen = jest.fn(() => Promise.resolve());
    const { container } = render(<DashboardVideoViewer video={item()} label="Clip" />);
    const root = screen.getByRole('group', { name: 'Clip' });
    (root as HTMLElement & { requestFullscreen: () => Promise<void> }).requestFullscreen =
      fullscreen;
    const v = mediaEl(container);
    loadMetadata(v);

    fireEvent.keyDown(root, { key: ' ' });
    expect(playSpy).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(root, { key: ' ' });
    expect(pauseSpy).toHaveBeenCalledTimes(1);

    v.currentTime = 10;
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(v.currentTime).toBe(15);
    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    expect(v.currentTime).toBe(0);

    fireEvent.keyDown(root, { key: 'm' });
    expect(v.muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();

    fireEvent.keyDown(root, { key: 'f' });
    expect(fullscreen).toHaveBeenCalledTimes(1);
  });

  it('does not toggle twice when space lands on a focused control button', () => {
    render(<DashboardVideoViewer video={item()} />);
    const btn = screen.getAllByRole('button', { name: 'Play' })[0];
    fireEvent.keyDown(btn, { key: ' ' });
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('shows a loading spinner while the video buffers', () => {
    const { container } = render(<DashboardVideoViewer video={item()} />);
    const v = mediaEl(container);
    fireEvent(v, new Event('waiting'));
    expect(screen.getByRole('status')).toHaveTextContent('Loading video');
    fireEvent(v, new Event('playing'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('lists the technical facts, preferring what the file itself reports', () => {
    const { container } = render(
      <DashboardVideoViewer
        video={{ ...item({ width: null, height: null, durationSeconds: null }), sizeBytes: 2_048_576 }}
      />,
    );
    loadMetadata(mediaEl(container));
    const facts = screen.getByRole('list', { name: 'Video details' });
    expect(within(facts).getByText('1:04')).toBeInTheDocument();
    expect(within(facts).getByText('1920 × 1080')).toBeInTheDocument();
    expect(within(facts).getByText('MP4')).toBeInTheDocument();
    expect(within(facts).getByText('2.0 MB')).toBeInTheDocument();
  });
});

describe('DashboardVideoViewer — source error', () => {
  it('says what went wrong instead of leaving a black box, and can try again', () => {
    const { container } = render(<DashboardVideoViewer video={item()} />);
    const v = mediaEl(container);
    Object.defineProperty(v, 'error', { configurable: true, value: { code: 4 } });
    fireEvent(v, new Event('error'));
    expect(screen.getByRole('alert')).toHaveTextContent(/can.t play this file/i);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(loadSpy).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats a ready video with no file as a source error', () => {
    const { container } = render(<DashboardVideoViewer video={item({ url: '' })} />);
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(/no video file/i);
  });
});

describe('DashboardVideoViewer — converting', () => {
  it('shows the poster and a Converting badge, never a <video> of the original', () => {
    const { container } = render(
      <DashboardVideoViewer
        video={item({ status: 'processing', url: 'https://s3.test/v1.mov', mimeType: 'video/quicktime' })}
        poll={false}
      />,
    );
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://img.test/v1.webp');
    expect(screen.getByText('Converting…')).toBeInTheDocument();
    expect(screen.getByText('MOV, converting to MP4')).toBeInTheDocument();
  });

  it('polls through the #49 hook and swaps to the MP4 once it is ready', async () => {
    jest.useFakeTimers();
    mockGetItem.mockResolvedValue(item({ status: 'ready', url: 'https://s3.test/v1-converted.mp4' }));
    const onUpdate = jest.fn();
    const { container } = render(
      <DashboardVideoViewer
        video={item({ status: 'processing', url: 'https://s3.test/v1.mov', mimeType: 'video/quicktime' })}
        onUpdate={onUpdate}
      />,
    );
    await act(async () => {
      jest.advanceTimersByTime(POLL_INITIAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockGetItem).toHaveBeenCalledWith('v1');
    expect(mediaEl(container)).toHaveAttribute('src', 'https://s3.test/v1-converted.mp4');
    expect(screen.queryByText('Converting…')).toBeNull();
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }));
  });

  it('asks nothing when polling is left to the parent', async () => {
    jest.useFakeTimers();
    render(<DashboardVideoViewer video={item({ status: 'processing' })} poll={false} />);
    await act(async () => {
      jest.advanceTimersByTime(POLL_INITIAL_MS * 10);
    });
    expect(mockGetItem).not.toHaveBeenCalled();
  });
});

describe('DashboardVideoViewer — failed', () => {
  it('shows the poster, the reason, and Exchange / Delete', () => {
    const onExchange = jest.fn();
    const onDelete = jest.fn();
    const { container } = render(
      <DashboardVideoViewer
        video={item({ status: 'failed', processingError: 'This video is 400 seconds long.' })}
        onExchange={onExchange}
        onDelete={onDelete}
      />,
    );
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('This video is 400 seconds long.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exchange' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onExchange).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(mockGetItem).not.toHaveBeenCalled();
  });
});
