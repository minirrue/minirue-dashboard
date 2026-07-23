'use client';

import React, { useState } from 'react';
import ManualFulfillmentPanel from './ManualFulfillmentPanel';
import ShippingServicePanel from './ShippingServicePanel';

type Tab = 'MANUAL' | 'SHIPPING_SERVICE';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'MANUAL', label: 'Manual' },
  { id: 'SHIPPING_SERVICE', label: 'Shipping service' },
];

export default function FulfillmentClient() {
  const [tab, setTab] = useState<Tab>('MANUAL');

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Fulfillment</h1>
      </div>

      <div role="tablist" aria-label="Fulfillment method" className="dash-tabstrip">
        {TABS.map((t) => (
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
        {tab === 'MANUAL' ? <ManualFulfillmentPanel /> : <ShippingServicePanel />}
      </div>
    </>
  );
}
