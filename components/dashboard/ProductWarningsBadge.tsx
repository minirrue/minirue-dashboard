'use client';

import Link from 'next/link';
import { usePricingWarnings } from '@/lib/hooks/use-pricing-warnings';
import { formatNavCount } from '@/lib/notifications/nav-counts';
import { IconWarningTriangle } from './PricingWarningsLink';
import './pricing-warnings.css';
import './product-warnings-badge.css';

/**
 * The yellow warnings badge on a product's edit page (minirue-dashboard#61).
 * Reads `byProduct` from the same hook as the topbar count, and links to the
 * Warnings tab filtered to this product. Renders nothing at 0.
 */
export default function ProductWarningsBadge({ productId }: { productId: string }) {
  const { byProduct } = usePricingWarnings();
  const count = byProduct[productId] ?? 0;
  if (count <= 0) return null;

  const label = `${count} pricing ${count === 1 ? 'warning' : 'warnings'} on this product`;
  return (
    <Link
      href={`/accounting?tab=warnings&product=${encodeURIComponent(productId)}`}
      className="dash-product-warn"
      aria-label={label}
      title={label}
    >
      <IconWarningTriangle size={14} />
      <span className="mr-num" aria-hidden="true">
        {formatNavCount(count)}
      </span>
    </Link>
  );
}
