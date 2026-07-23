'use client';

import React, { useState, useCallback } from 'react';
import RefundableOrdersPanel from './RefundableOrdersPanel';
import RefundHistoryPanel from './RefundHistoryPanel';

type Tab = 'ORDERS' | 'HISTORY';

export default function RefundsClient() {
  const [tab, setTab] = useState<Tab>('ORDERS');
  const [refreshToken, setRefreshToken] = useState(0);

  // Refunding on the Orders tab must show up on History without a page reload.
  const handleRefunded = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Refunds</h1>
      </div>

      <div role="tablist" aria-label="Refunds view" className="dash-filters" style={{ gap: 8 }}>
        {([
          { id: 'ORDERS' as const, label: 'Orders' },
          { id: 'HISTORY' as const, label: 'Refund history' },
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
        {tab === 'ORDERS' ? (
          <RefundableOrdersPanel onRefunded={handleRefunded} />
        ) : (
          <RefundHistoryPanel refreshToken={refreshToken} />
        )}
      </div>
    </>
  );
}
