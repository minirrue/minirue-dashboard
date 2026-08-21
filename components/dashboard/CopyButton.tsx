'use client';

import React from 'react';

/**
 * Copies a value and says so, briefly.
 *
 * Extracted when a second screen needed it (the customer id, 2026-08-21) — the
 * variant SKU row had rolled its own. Anything the dashboard shows that a
 * person has to paste somewhere else — an id, a SKU, a tracking number — wants
 * this rather than a fourth hand-written copy of the same three lines.
 *
 * The confirmation is the point. `navigator.clipboard.writeText` gives no
 * visible feedback of its own, so without a state change the operator cannot
 * tell a successful copy from a dead button and presses it again.
 */
export default function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  traceId,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  traceId?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clearing on unmount matters: the operator can copy an id and immediately
  // navigate away, and a setState landing on an unmounted component is a
  // warning in the console for something nobody did wrong.
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked — an insecure context, or permission denied. The
      // value is still selectable on the page, so there is nothing to recover
      // from and an error banner would be noise.
    }
  }

  return (
    <button
      type="button"
      className="dash-btn-ghost"
      onClick={() => void handleCopy()}
      aria-label={`${label} ${value}`}
      data-trace-id={traceId}
      style={{
        fontFamily: 'var(--mr-font-label)',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        marginLeft: 8,
        // Dimmed until used, so a row of these does not compete with the
        // values they belong to.
        opacity: copied ? 1 : 0.55,
        transition: 'opacity var(--mr-dur-fast) var(--mr-ease-out)',
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
