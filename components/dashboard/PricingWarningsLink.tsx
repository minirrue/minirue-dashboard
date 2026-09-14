'use client';

import Link from 'next/link';
import { usePricingWarnings } from '@/lib/hooks/use-pricing-warnings';
import { formatNavCount } from '@/lib/notifications/nav-counts';
import './pricing-warnings.css';

export const PRICING_WARNINGS_HREF = '/accounting?tab=warnings';

export function pricingWarningsLabel(total: number): string {
  return `${total} pricing ${total === 1 ? 'warning' : 'warnings'}`;
}

export function IconWarningTriangle({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        className="dash-warn-triangle-fill"
        d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
      />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * The yellow triangle beside the bell (minirue-dashboard#60). It sits in both
 * homes of the bell, the mobile topbar and the desktop sidebar brand, and
 * renders nothing at 0 warnings. Admin-only by way of the hook, which reports
 * 0 for every other role.
 */
export default function PricingWarningsLink() {
  const { total } = usePricingWarnings();
  if (total <= 0) return null;

  return (
    <Link
      href={PRICING_WARNINGS_HREF}
      className="dash-warn-btn"
      aria-label={pricingWarningsLabel(total)}
      title={pricingWarningsLabel(total)}
    >
      <IconWarningTriangle size={17} />
      {/* The count is on the link's label already; hidden so it is not read twice. */}
      <span className="dash-warn-count" aria-hidden="true">
        {formatNavCount(total)}
      </span>
    </Link>
  );
}
