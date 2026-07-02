'use client';

import { useEffect, useMemo, useState } from 'react';

import CollabAccessDenied from '@/components/collab/access-denied';

import {
  CollabEmptyState,
  CollabErrorPanel,
  CollabLoadingBlock,
  CollabPageHeader,
  CollabScopeNote,
  CollabTableCard,
  formatEgp,
} from '@/components/collab/collab-ui';

import { apiCollabAnalytics, apiCollabOverview } from '@/lib/api/collab-portal';

import type { ApiError } from '@/lib/api/client';

type Period = '7d' | '30d' | '90d';

type AnalyticsPayload = Awaited<ReturnType<typeof apiCollabAnalytics>>;

function formatRevenueCents(cents: number): string {
  return formatEgp(cents / 100);
}

export default function CollabAnalyticsClient() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30d');
  const [displayName, setDisplayName] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([apiCollabOverview(), apiCollabAnalytics(period)])
      .then(([overview, data]) => {
        if (cancelled) return;
        setAllowed(overview.modules.includes('ANALYTICS'));
        setDisplayName(overview.displayName || overview.brandSlug);
        setAnalytics(data);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message || 'Failed to load analytics');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const dailyRows = useMemo(() => analytics?.daily ?? [], [analytics]);

  const maxOrders = Math.max(1, ...dailyRows.map((r) => r.orders));

  if (error) {
    return <CollabErrorPanel message={error} />;
  }

  if (loading || allowed === null) {
    return <CollabLoadingBlock />;
  }

  if (!allowed) {
    return <CollabAccessDenied moduleName="Analytics" />;
  }

  const kpis = analytics?.kpis ?? {
    ordersCount: 0,
    revenueCents: 0,
    productsActive: 0,
  };

  return (
    <>
      <CollabPageHeader
        title="Analytics"
        subtitle={displayName ? `Performance for ${displayName}` : 'Brand performance'}
        action={
          <label className="collab-period-select">
            <span className="dash-label">Period</span>
            <select
              className="dash-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              aria-label="Analytics period"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </label>
        }
      />

      <CollabScopeNote />

      <p className="collab-summary-line">
        <span>
          <strong>{kpis.ordersCount}</strong> orders
        </span>
        <span className="collab-summary-sep">·</span>
        <span>
          Revenue <strong>{formatRevenueCents(kpis.revenueCents)}</strong>
        </span>
        <span className="collab-summary-sep">·</span>
        <span>
          <strong>{kpis.productsActive}</strong> live SKUs
        </span>
      </p>

      <div className="dash-card collab-section-card">
        <h2 className="dash-card-title">Daily orders</h2>
        {dailyRows.length === 0 ? (
          <p className="collab-empty-copy">
            No orders in this period yet. Activity will appear here as customers buy from your brand.
          </p>
        ) : (
          <table className="dash-revenue-chart collab-analytics-chart">
            <tbody>
              {dailyRows.map((row) => (
                <tr key={row.date}>
                  <td className="collab-chart-date">{row.date}</td>
                  <td className="dash-revenue-bar-cell">
                    <div className="dash-revenue-bar-track">
                      <div
                        className="dash-revenue-bar-fill"
                        style={{ width: `${(row.orders / maxOrders) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="collab-chart-count">{row.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dailyRows.length === 0 ? (
        <CollabEmptyState
          title="No activity in this period"
          copy="Try a longer date range, or check back once your brand page receives orders."
        />
      ) : (
        <CollabTableCard>
          <div className="collab-table-heading">
            <h2 className="dash-card-title">Daily breakdown</h2>
          </div>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.slice(0, 14).map((row) => (
                <tr key={`act-${row.date}`}>
                  <td>{row.date}</td>
                  <td>{row.orders}</td>
                  <td>{formatRevenueCents(row.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollabTableCard>
      )}
    </>
  );
}
