'use client';

import React, { useEffect, useState } from 'react';
import ManualFulfillmentPanel from './ManualFulfillmentPanel';
import ShippingServicePanel from './ShippingServicePanel';
import SameDayQueuePanel from './SameDayQueuePanel';
import DeliverySettingsPanel from './DeliverySettingsPanel';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';
import { apiMe } from '@/lib/api/auth';
import { isAdminRole } from '@/lib/auth/roles';

type Tab = 'MANUAL' | 'SHIPPING_SERVICE' | 'SAME_DAY' | 'SETTINGS';

/**
 * Same-day queue: reachable by ADMIN and STAFF (the backend's same-day-fee
 * endpoint allows both — dashboard#84 / backend#186). Settings: ADMIN-only,
 * even though `/fulfillment` itself is open to STAFF (`lib/auth/roles.ts`
 * '/fulfillment': ADMIN_AND_SUPPORT) — gated here rather than at the route,
 * since the rest of the Fulfillment tab stays available to STAFF.
 */
const BASE_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'MANUAL', label: 'Manual' },
  { id: 'SHIPPING_SERVICE', label: 'Shipping service' },
  { id: 'SAME_DAY', label: 'Same-day queue' },
];

export default function FulfillmentClient() {
  // Clears the Fulfillment badge the moment this screen is open, regardless
  // of which tab is active — same pattern as Orders/Refunds.
  useClearNavBadge(HREF_CATEGORIES['/fulfillment']);
  const [tab, setTab] = useState<Tab>('MANUAL');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiMe()
      .then((me) => {
        if (!cancelled) setIsAdmin(isAdminRole(me.role));
      })
      .catch(() => {
        /* STAFF without a resolvable role simply doesn't see Settings */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs = isAdmin ? [...BASE_TABS, { id: 'SETTINGS' as const, label: 'Settings' }] : BASE_TABS;

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Fulfillment</h1>
      </div>

      <div role="tablist" aria-label="Fulfillment method" className="dash-tabstrip">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`ful-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`ful-panel-${t.id}`}
            className={tab === t.id ? 'dash-btn-primary' : 'dash-btn-secondary'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'SHIPPING_SERVICE' && (
              <span className="dash-sidebar-link-badge" style={{ marginLeft: 8 }}>
                Preview
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`ful-panel-${tab}`}
        aria-labelledby={`ful-tab-${tab}`}
      >
        {tab === 'MANUAL' && <ManualFulfillmentPanel />}
        {tab === 'SHIPPING_SERVICE' && <ShippingServicePanel />}
        {tab === 'SAME_DAY' && <SameDayQueuePanel />}
        {tab === 'SETTINGS' && isAdmin && <DeliverySettingsPanel />}
      </div>
    </>
  );
}
