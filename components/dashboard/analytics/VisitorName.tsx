'use client';

import React from 'react';
import Link from 'next/link';

export interface VisitorIdentity {
  visitorId?: string | null;
  visitorNumber?: number | null;
  customer?: { id: string; name: string | null } | null;
}

/**
 * The one way a visitor is named anywhere in the dashboard (owner, 2026-09-19:
 * "no longer UUID … incremental visitor number, and if it's already a customer
 * … the actual customer name, and his go-to"). A signed-up customer shows by
 * name; everyone else is "Visitor #1042". The raw id never shows.
 */
export function visitorLabel(v: VisitorIdentity): string {
  if (v.customer?.name) return v.customer.name;
  if (v.visitorNumber) return `Visitor #${v.visitorNumber.toLocaleString('en-US')}`;
  if (v.customer) return 'Customer';
  // Only until the backend sends numbers: short and clearly a placeholder.
  return v.visitorId ? `Visitor ·${v.visitorId.slice(0, 4).toUpperCase()}` : 'Visitor';
}

export default function VisitorName({
  visitor,
  link = 'visitor',
  className,
}: {
  visitor: VisitorIdentity;
  /** Where the name goes: the visitor's page, the customer profile, or nowhere. */
  link?: 'visitor' | 'customer' | 'none';
  className?: string;
}) {
  const label = visitorLabel(visitor);
  const isCustomer = !!visitor.customer;
  const href =
    link === 'customer' && visitor.customer
      ? `/customers/${visitor.customer.id}`
      : link === 'visitor' && visitor.visitorId
        ? `/analytics/visitors/${visitor.visitorId}`
        : null;
  const content = (
    <>
      {label}
      {isCustomer && <span className="dash-visitor-name__badge">Customer</span>}
    </>
  );
  return href ? (
    <Link href={href} className={`dash-visitor-name${className ? ` ${className}` : ''}`} data-customer={isCustomer || undefined}>
      {content}
    </Link>
  ) : (
    <span className={`dash-visitor-name${className ? ` ${className}` : ''}`} data-customer={isCustomer || undefined}>
      {content}
    </span>
  );
}
