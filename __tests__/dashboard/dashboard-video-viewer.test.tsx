import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardVideoViewer from '@/components/dashboard/DashboardVideoViewer';

jest.mock('@/components/dashboard/RetryingImage', () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt?: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ''} className={className} />
  ),
}));

const ready = {
  url: 'https://media.test/clip.mp4',
  posterUrl: 'https://media.test/poster.webp',
  status: 'ready' as const,
  durationSeconds: 65,
  width: 1920,
  height: 1080,
  mimeType: 'video/mp4',
};

describe('DashboardVideoViewer', () => {
  it('renders a ready video with house controls, facts, and no native controls', () => {
    render(<DashboardVideoViewer media={ready} />);

    const video = screen.getByLabelText('Video preview');
    expect(video).toBeInstanceOf(HTMLVideoElement);
    expect(video).not.toHaveAttribute('controls');
    expect(screen.getByRole('button', { name: 'Play video' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mute video' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Toggle fullscreen' })).toBeVisible();
    expect(screen.getByLabelText('Video details')).toHaveTextContent('1:05');
    expect(screen.getByLabelText('Video details')).toHaveTextContent('1920 × 1080');
    expect(screen.getByLabelText('Video details')).toHaveTextContent('MP4');
  });

  it('shows the poster and live conversion status without loading the source', () => {
    render(<DashboardVideoViewer media={{ ...ready, status: 'processing', url: 'original.mov' }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Converting video');
    expect(screen.getByText(/update automatically/i)).toBeVisible();
    expect(document.querySelector('video')).toBeNull();
  });

  it('shows the server failure reason and recovery actions', async () => {
    const user = userEvent.setup();
    const onExchange = jest.fn();
    const onDelete = jest.fn();
    render(
      <DashboardVideoViewer
        media={{ ...ready, status: 'failed', processingError: 'The clip is longer than 120 seconds.' }}
        onExchange={onExchange}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('The clip is longer than 120 seconds.');
    await user.click(screen.getByRole('button', { name: 'Exchange' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onExchange).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('replaces the controls with a clear source error', () => {
    render(<DashboardVideoViewer media={ready} />);
    fireEvent.error(screen.getByLabelText('Video preview'));

    expect(screen.getByRole('alert')).toHaveTextContent('Video unavailable');
    expect(screen.queryByRole('button', { name: 'Play video' })).toBeNull();
  });

  it('announces buffering and supports the documented keyboard shortcuts', () => {
    render(<DashboardVideoViewer media={ready} />);
    const video = screen.getByLabelText('Video preview') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 65 });
    Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 20 });
    const stage = video.parentElement as HTMLElement;

    fireEvent.waiting(video);
    expect(screen.getByRole('status')).toHaveTextContent('Buffering video');
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(video.currentTime).toBe(25);
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(video.currentTime).toBe(20);
    fireEvent.keyDown(stage, { key: 'm' });
    expect(video.muted).toBe(true);
  });
});
