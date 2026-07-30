'use client';

import React from 'react';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { Funnel } from '@/components/dashboard/charts';
import {
  useAnalyticsRange,
  useCartFunnel,
  useCheckoutFunnel,
  usePaymentsFunnel,
  useAbandonedCheckouts,
} from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import { egp } from '@/lib/api/analytics-insights';
import type {
  AbandonedRow,
  AnalyticsFreshness,
  CartFunnelStep,
  CheckoutFunnelStep,
  PaymentMethodRow,
} from '@/lib/api/analytics-insights';

function RangeControl({
  range,
  onChange,
}: {
  range: AnalyticsRangeState;
  onChange: (next: Partial<AnalyticsRangeState>) => void;
}) {
  return (
    <div className="dash-filters" style={{ marginBottom: 20 }}>
      <label className="dash-field" style={{ maxWidth: 160 }}>
        <span className="dash-label">From</span>
        <input type="date" className="dash-input" value={range.from} max={range.to} onChange={(e) => onChange({ from: e.target.value })} />
      </label>
      <label className="dash-field" style={{ maxWidth: 160 }}>
        <span className="dash-label">To</span>
        <input type="date" className="dash-input" value={range.to} min={range.from} onChange={(e) => onChange({ to: e.target.value })} />
      </label>
      <label className="dash-checkbox-label" style={{ marginLeft: 8 }}>
        <input type="checkbox" className="dash-checkbox" checked={range.compare} onChange={(e) => onChange({ compare: e.target.checked })} />
        Compare to previous period
      </label>
    </div>
  );
}

function FreshnessNote({ freshness }: { freshness: AnalyticsFreshness }) {
  if (!freshness.rollupLastOkAt) return null;
  const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(freshness.rollupLastOkAt).getTime()) / 60_000));
  const label = minutesAgo === 0 ? 'just now' : `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
  return (
    <p style={{ fontSize: 12, color: 'var(--mr-fg-4)', margin: '4px 0 0' }}>
      Updated {label}
      {freshness.staleBuckets > 0 && ` · ${freshness.staleBuckets} bucket${freshness.staleBuckets === 1 ? '' : 's'} still catching up`}
    </p>
  );
}

function ScreenSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="dash-card" style={{ height: 160 }}>
          <span className="dash-skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      ))}
    </div>
  );
}

function ScreenError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="dash-card" style={{ padding: 32, textAlign: 'center' }}>
      <p className="dash-inline-error" style={{ display: 'inline-block' }}>{message}</p>
      <div style={{ marginTop: 12 }}>
        <button className="dash-btn-secondary" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}

function ScreenEmpty({ message }: { message: string }) {
  return (
    <div className="dash-card" style={{ padding: 32, textAlign: 'center' }}>
      <p className="dash-help-text" style={{ margin: 0 }}>{message}</p>
    </div>
  );
}

// `Funnel` is a self-contained dash-card (title, table toggle, and its own
// "No data for this period." empty state via ChartFrame) — this adapts the
// real `{ step, count }` step shape (`CartFunnelStep`/`CheckoutFunnelStep`)
// to the chart's own `{ label, value }`, which derives rate-from-start and
// drop-off itself from stage order.
function CartOrCheckoutFunnelCard({
  title,
  steps,
}: {
  title: string;
  steps: (CartFunnelStep | CheckoutFunnelStep)[];
}) {
  return <Funnel stages={steps.map((s) => ({ label: s.step, value: s.count }))} title={title} />;
}

const ABANDONED_COLUMNS: Column<AbandonedRow>[] = [
  {
    key: 'cartId',
    label: 'Cart',
    render: (row) => row.cartId ?? row.visitorId ?? row.userId ?? '—',
  },
  { key: 'stage', label: 'Stage reached' },
  { key: 'valueMinor', label: 'Cart value', align: 'right', sortable: true, render: (row) => egp(row.valueMinor) },
  { key: 'channel', label: 'Channel', render: (row) => row.channel ?? '—' },
  { key: 'contactable', label: 'Contactable', render: (row) => (row.contactable ? 'Yes' : 'No') },
  {
    key: 'lastSeenAt',
    label: 'Last seen',
    render: (row) => new Date(row.lastSeenAt).toLocaleString('en-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  },
];

/**
 * `funnel/payments` is a per-payment-method breakdown, not a funnel — see
 * lane-16 report. `successRate` is `null` for COD (pending-until-delivery
 * makes a "success rate" meaningless over any dashboard window) and renders
 * as "not applicable", never as 0%.
 */
const PAYMENT_COLUMNS: Column<PaymentMethodRow>[] = [
  { key: 'method', label: 'Method' },
  { key: 'gateway', label: 'Gateway' },
  { key: 'attempts', label: 'Attempts', align: 'right', sortable: true },
  { key: 'orders', label: 'Orders', align: 'right', sortable: true },
  { key: 'amountMinor', label: 'Amount', align: 'right', sortable: true, render: (row) => egp(row.amountMinor) },
  {
    key: 'successRate',
    label: 'Success rate',
    align: 'right',
    render: (row) => (row.successRate == null ? 'Not applicable' : `${(row.successRate * 100).toFixed(1)}%`),
  },
];

export default function CheckoutFunnelClient() {
  const { range, setRange } = useAnalyticsRange();
  const cart = useCartFunnel(range);
  const checkout = useCheckoutFunnel(range);
  const payments = usePaymentsFunnel(range);
  const abandoned = useAbandonedCheckouts(range);

  const isLoading = cart.isLoading || checkout.isLoading || payments.isLoading || abandoned.isLoading;
  const isError = cart.isError || checkout.isError || payments.isError || abandoned.isError;
  const errorMessage =
    cart.error?.message ??
    checkout.error?.message ??
    payments.error?.message ??
    abandoned.error?.message ??
    'Checkout data could not load.';

  const retry = () => {
    void cart.refetch();
    void checkout.refetch();
    void payments.refetch();
    void abandoned.refetch();
  };

  const noHistory = checkout.data ? !checkout.data.freshness.rollupLastOkAt : false;

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">Checkout</h1>
      </div>
      <RangeControl range={range} onChange={setRange} />

      {isLoading ? (
        <ScreenSkeleton />
      ) : isError ? (
        <ScreenError message={errorMessage} onRetry={retry} />
      ) : noHistory ? (
        <ScreenEmpty message="Analytics isn't collecting data yet. Once tracking is live, figures will show up here." />
      ) : (
        <>
          {checkout.data && <FreshnessNote freshness={checkout.data.freshness} />}

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16, margin: '20px 0' }}
          >
            <CartOrCheckoutFunnelCard title="Cart funnel" steps={cart.data?.data ?? []} />
            <CartOrCheckoutFunnelCard title="Checkout funnel" steps={checkout.data?.data ?? []} />
          </div>

          <p className="dash-section-title" style={{ marginBottom: 12 }}>Payment methods</p>
          <DashboardTable<PaymentMethodRow>
            columns={PAYMENT_COLUMNS}
            data={payments.data?.data ?? []}
            emptyMessage="No payment attempts in this range."
            tableTraceId="PG-DASHBOARD-ANL-CHECKOUT::EL-TABLE-payment-methods"
          />

          <p className="dash-section-title" style={{ margin: '20px 0 12px' }}>Abandoned checkouts</p>
          <DashboardTable<AbandonedRow>
            columns={ABANDONED_COLUMNS}
            data={abandoned.data?.data ?? []}
            emptyMessage="No abandoned checkouts in this range."
            tableTraceId="PG-DASHBOARD-ANL-CHECKOUT::EL-TABLE-abandoned"
          />
        </>
      )}
    </>
  );
}
