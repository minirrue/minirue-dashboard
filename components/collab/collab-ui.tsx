'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { CollabModule } from '@/lib/api/collab-portal';
import type { CollaboratorModule, CollaboratorStatus } from '@/lib/api/collaborators';

const MODULE_LABELS: Record<CollaboratorModule, string> = {
  ORDERS: 'Orders',
  PRODUCTS: 'Products',
  ANALYTICS: 'Analytics',
};

export function formatModuleLabel(mod: CollaboratorModule | CollabModule): string {
  return MODULE_LABELS[mod as CollaboratorModule] ?? mod;
}

export function formatModuleList(modules: CollaboratorModule[] | CollabModule[]): string {
  if (!modules.length) return '';
  return modules.map((m) => formatModuleLabel(m).toLowerCase()).join(', ');
}

const COLLABORATOR_STATUS_ATTR: Record<CollaboratorStatus, string> = {
  PENDING_ACTIVATION: 'pending',
  ACTIVE: 'confirmed',
  SUSPENDED: 'cancelled',
};

const COLLABORATOR_STATUS_LABEL: Record<CollaboratorStatus, string> = {
  PENDING_ACTIVATION: 'Pending activation',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
};

export function CollaboratorStatusBadge({ status }: { status: CollaboratorStatus }) {
  return (
    <span className="dash-status" data-status={COLLABORATOR_STATUS_ATTR[status]}>
      <span className="dash-status-dot" />
      {COLLABORATOR_STATUS_LABEL[status]}
    </span>
  );
}

const ORDER_STATUS_ATTR: Record<string, string> = {
  pending: 'pending',
  confirmed: 'confirmed',
  processing: 'processing',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  in_transit: 'in_transit',
  returned: 'returned',
};

export function mapOrderStatus(raw: string): { attr: string; label: string } {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
  const attr = ORDER_STATUS_ATTR[key] ?? 'pending';
  const label = raw.trim() || 'Pending';
  return { attr, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

export function CollabLoadingBlock({ lines = 2 }: { lines?: number }) {
  return (
    <div className="dash-card collab-loading-block" aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="dash-skeleton collab-loading-line"
          style={{ width: i === 0 ? '42%' : '68%' }}
        />
      ))}
    </div>
  );
}

export function CollabErrorPanel({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="dash-card collab-error-panel" role="alert">
      <p className="dash-error">{message}</p>
      {action}
    </div>
  );
}

export function CollabEmptyState({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="dash-card collab-empty-panel">
      <p className="collab-empty-title">{title}</p>
      <p className="collab-empty-copy">{copy}</p>
      {action}
    </div>
  );
}

export function CollabApiNotice({ children }: { children: ReactNode }) {
  return <p className="dash-role-notice collab-api-notice">{children}</p>;
}

export function CollabTableCard({ children }: { children: ReactNode }) {
  return <div className="dash-card collab-table-card">{children}</div>;
}

export function CollaboratorModuleChips({ modules }: { modules: CollaboratorModule[] }) {
  if (!modules.length) return <span className="dash-muted">—</span>;
  return (
    <span className="collab-module-chips">
      {modules.map((m) => (
        <span key={m} className="collab-module-chip">
          {formatModuleLabel(m)}
        </span>
      ))}
    </span>
  );
}

type PublishState = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | string;

const PUBLISH_STATUS_ATTR: Record<string, string> = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
};

const PUBLISH_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
};

export function ProductStatusBadge({ state }: { state: PublishState }) {
  const key = String(state ?? 'DRAFT').toUpperCase();
  const attr = PUBLISH_STATUS_ATTR[key] ?? 'draft';
  const label = PUBLISH_LABELS[key] ?? key;
  return (
    <span className="dash-status" data-status={attr}>
      <span className="dash-status-dot" />
      {label}
    </span>
  );
}

export function CollabTrustBanner({ trusted }: { trusted: boolean }) {
  return (
    <div className="collab-trust-banner" role="status" data-trust={trusted ? "trusted" : "review"}>
      {trusted ? (
        <p>
          <strong>Trusted partner</strong> — new products go live on your brand page immediately.
        </p>
      ) : (
        <p>
          <strong>Review required</strong> — each new product is sent to MiniRue for approval before
          it appears on the storefront.
        </p>
      )}
    </div>
  );
}

export function CollabProfileGate({ brandSlug }: { brandSlug: string }) {
  return (
    <div className="dash-role-notice collab-profile-gate">
      <p>
        Add a <strong>display name</strong> on your{' '}
        <Link href="/collab/brand" className="dash-link">
          brand profile
        </Link>{' '}
        before creating products. Your storefront slug is <code className="dash-slug">{brandSlug}</code>.
      </p>
    </div>
  );
}

export function CollabScopeNote() {
  return (
    <p className="collab-scope-note">
      Figures below include only orders and products for your brand — not other partners or store-wide
      totals.
    </p>
  );
}

export function formatEgp(amount: string | number | null | undefined): string {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number.parseFloat(String(amount));
  if (Number.isNaN(n)) return String(amount);
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2,
  }).format(n);
}

export function CollabPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="dash-page-header">
      <div>
        <h1 className="dash-page-title">{title}</h1>
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <p className="dash-page-subtitle">{subtitle}</p>
          ) : (
            <div className="dash-page-subtitle">{subtitle}</div>
          )
        ) : null}
      </div>
      {action}
    </div>
  );
}
