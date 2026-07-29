interface StarRatingProps {
  /** Whole stars, 1-5. Half stars do not exist in this system. */
  value: number;
  size?: 'sm' | 'md';
}

/**
 * Read-only. Moderators look at ratings; they never give them, so there is no
 * interactive variant here — the star picker lives on the storefront, where
 * the person who actually bought the thing is.
 */
export default function StarRating({ value, size = 'sm' }: StarRatingProps) {
  const px = size === 'sm' ? 13 : 16;
  const filled = Math.max(0, Math.min(5, Math.round(value)));

  return (
    <span
      className="dash-star-rating"
      // Five identical glyphs read as nothing to a screen reader, so the row
      // announces the number and the glyphs are hidden.
      aria-label={`${filled} out of 5`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          aria-hidden="true"
          width={px}
          height={px}
          viewBox="0 0 24 24"
          fill={i <= filled ? 'var(--mr-gold-500)' : 'none'}
          stroke={i <= filled ? 'var(--mr-gold-500)' : 'var(--mr-dash-hair)'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" />
        </svg>
      ))}
      <span
        aria-hidden="true"
        className="mr-num"
        style={{
          marginLeft: 4,
          fontSize: 'var(--mr-text-xs)',
          color: 'var(--mr-fg-3)',
        }}
      >
        {filled}
      </span>
    </span>
  );
}
