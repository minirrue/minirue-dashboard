import { describe, expect, it } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RetryingImage from '@/components/dashboard/RetryingImage';

/**
 * Task 10 (2026-07-30) — the first-ever request for a freshly-uploaded
 * image's URL is a guaranteed cold miss (Cloudflare -> nginx -> imgproxy ->
 * Garage), and nothing retried it. These pin RetryingImage's backoff-retry
 * and give-up behaviour.
 */
describe('RetryingImage', () => {
  it('retries a failed image with backoff and eventually shows it', async () => {
    render(<RetryingImage src="https://img.example/x.webp" alt="" />);
    fireEvent.error(screen.getByRole('presentation'));
    await waitFor(() =>
      expect(screen.getByRole('presentation')).toHaveAttribute(
        'src',
        expect.stringContaining('retry=1'),
      ),
    );
  });

  it('gives up after the last attempt and shows a retry affordance', async () => {
    render(<RetryingImage src="https://img.example/x.webp" alt="" maxAttempts={2} />);
    fireEvent.error(screen.getByRole('presentation'));
    fireEvent.error(await screen.findByRole('presentation'));
    expect(await screen.findByText(/couldn.t load/i)).toBeInTheDocument();
  });

  it('renders the plain src with no attempt so far', () => {
    render(<RetryingImage src="https://img.example/y.webp" alt="" />);
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      'https://img.example/y.webp',
    );
  });

  it('tapping the retry affordance resets the attempt counter and tries the original src again', async () => {
    render(<RetryingImage src="https://img.example/z.webp" alt="" maxAttempts={1} />);
    fireEvent.error(screen.getByRole('presentation'));
    const retryButton = await screen.findByText(/couldn.t load/i);
    fireEvent.click(retryButton);
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      'https://img.example/z.webp',
    );
  });

  it('appends the retry param with & when the src already has a query string', async () => {
    render(<RetryingImage src="https://img.example/x.webp?sig=abc" alt="" />);
    fireEvent.error(screen.getByRole('presentation'));
    await waitFor(() =>
      expect(screen.getByRole('presentation')).toHaveAttribute(
        'src',
        'https://img.example/x.webp?sig=abc&retry=1',
      ),
    );
  });
});
