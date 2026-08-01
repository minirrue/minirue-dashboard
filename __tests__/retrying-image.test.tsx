import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RetryingImage from '@/components/dashboard/RetryingImage';

/**
 * Task 10 (2026-07-30) — the first-ever request for a freshly-uploaded
 * image's URL is a guaranteed cold miss (Cloudflare -> nginx -> imgproxy ->
 * Garage), and nothing retried it. These pin RetryingImage's backoff-retry
 * behaviour.
 *
 * 2026-08-01 — and what it does while still retrying. The owner uploaded a
 * customer avatar from the storefront ("seamless and so beautiful"), opened
 * the same customer in the dashboard, and got a dashed box reading
 * "Couldn't load — tap to retry". Same picture, same storage: only the
 * component differed. A thumbnail must never become an error message.
 */
describe('RetryingImage', () => {
  it('retries a failed image with backoff and eventually shows it', async () => {
    render(<RetryingImage src="https://img.example/x.webp" alt="" />);
    fireEvent.error(screen.getByRole('presentation', { hidden: true }));
    await waitFor(() =>
      expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
        'src',
        expect.stringContaining('retry=1'),
      ),
    );
  });

  it('renders the plain src with no attempt so far', () => {
    render(<RetryingImage src="https://img.example/y.webp" alt="" />);
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      'https://img.example/y.webp',
    );
  });

  it('appends the retry param with & when the src already has a query string', async () => {
    render(<RetryingImage src="https://img.example/x.webp?sig=abc" alt="" />);
    fireEvent.error(screen.getByRole('presentation', { hidden: true }));
    await waitFor(() =>
      expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
        'src',
        'https://img.example/x.webp?sig=abc&retry=1',
      ),
    );
  });

  describe('while the image is not loading', () => {
    it('never shows error text — that is what the owner saw instead of a photo', async () => {
      render(<RetryingImage src="https://img.example/x.webp" alt="" maxAttempts={2} />);
      fireEvent.error(screen.getByRole('presentation', { hidden: true }));
      fireEvent.error(screen.getByRole('presentation', { hidden: true }));

      await screen.findByRole('button');
      expect(screen.queryByText(/couldn.t load/i)).not.toBeInTheDocument();
    });

    it("shows the caller's fallback, so an avatar degrades to its own empty state", async () => {
      render(
        <RetryingImage
          src="https://img.example/x.webp"
          alt=""
          fallback={<span data-testid="avatar-silhouette" />}
        />,
      );
      fireEvent.error(screen.getByRole('presentation', { hidden: true }));
      expect(await screen.findByTestId('avatar-silhouette')).toBeInTheDocument();
    });

    /**
     * The reason the fallback is a COVER and not a replacement. Unmounting the
     * `<img>` would cancel the retry that is about to succeed and leave
     * nothing to fire `onLoad` when it does — the image could then never come
     * back on its own, which is exactly the "frozen broken forever" bug this
     * component was written to fix.
     */
    it('keeps retrying underneath and swaps the picture back in when one lands', async () => {
      render(<RetryingImage src="https://img.example/x.webp" alt="" />);
      fireEvent.error(screen.getByRole('presentation', { hidden: true }));
      await screen.findByRole('button');

      fireEvent.load(screen.getByRole('presentation', { hidden: true }));

      await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument());
      expect(screen.getByRole('presentation')).toBeInTheDocument();
    });

    it('still lets a click force an immediate retry of the original src', async () => {
      render(<RetryingImage src="https://img.example/z.webp" alt="" maxAttempts={1} />);
      fireEvent.error(screen.getByRole('presentation', { hidden: true }));

      fireEvent.click(await screen.findByRole('button'));

      expect(screen.getByRole('presentation')).toHaveAttribute(
        'src',
        'https://img.example/z.webp',
      );
    });
  });
});
