'use client';

import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import RefundableOrdersPanel from './RefundableOrdersPanel';
import RefundHistoryPanel from './RefundHistoryPanel';
import PaymentsPanel from './PaymentsPanel';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';

type Tab = 'ORDERS' | 'HISTORY' | 'PAYMENTS';

export default function RefundsClient() {
  // Clears the Refunds badge (REFUND) the moment this screen is open.
  useClearNavBadge(HREF_CATEGORIES['/refunds']);

  /*
   * A `?payment=<id>` link opens on the Payments tab, not on Orders.
   *
   * The Payments card on an order links here, and landing on the default tab
   * would show the visitor a screen with no payment on it and no clue that the
   * one they clicked is a tab away. The id itself is read by the panel, which
   * marks that row.
   */
  const params = useSearchParams();
  const highlightPaymentId = params.get('payment');
  const [tab, setTab] = useState<Tab>(
    highlightPaymentId || params.get('tab') === 'payments' ? 'PAYMENTS' : 'ORDERS',
  );
  const [refreshToken, setRefreshToken] = useState(0);

  // Refunding on the Orders tab must show up on History without a page reload.
  const handleRefunded = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Refunds and payments</h1>
      </div>

      <div role="tablist" aria-label="Refunds and payments view" className="dash-tabstrip">
        {([
          { id: 'ORDERS' as const, label: 'Orders' },
          { id: 'HISTORY' as const, label: 'Refund history' },
          { id: 'PAYMENTS' as const, label: 'Payments' },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`ref-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`ref-panel-${t.id}`}
            className={tab === t.id ? 'dash-btn-primary' : 'dash-btn-secondary'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`ref-panel-${tab}`} aria-labelledby={`ref-tab-${tab}`}>
        {tab === 'ORDERS' && <RefundableOrdersPanel onRefunded={handleRefunded} />}
        {tab === 'HISTORY' && <RefundHistoryPanel refreshToken={refreshToken} />}
        {tab === 'PAYMENTS' && <PaymentsPanel highlightId={highlightPaymentId} />}
      </div>
    </>
  );
}
