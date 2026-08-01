'use client';

import React from 'react';
import CodesPanel from './CodesPanel';
import SitewidePanel from './SitewidePanel';
import UsagePanel from './UsagePanel';

type Tab = 'CODES' | 'SITEWIDE' | 'USAGE';

/**
 * Discounts.
 *
 * Three things, because there are exactly three ways money comes off an order:
 * a code somebody types, a markdown that applies to everyone, and the record of
 * what has already been given away.
 *
 * The two ways never stack — a shopper gets whichever saves more on their
 * actual bag — so these are separate screens rather than one form with a mode
 * switch. Nothing here can be combined by accident.
 */
export default function DiscountsClient() {
  const [tab, setTab] = React.useState<Tab>('CODES');
  const [refreshToken, setRefreshToken] = React.useState(0);
  const bump = React.useCallback(() => setRefreshToken((n) => n + 1), []);

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Discounts</h1>
      </div>

      <div role="tablist" aria-label="Discounts view" className="dash-tabstrip">
        {(
          [
            { id: 'CODES' as const, label: 'Codes' },
            { id: 'SITEWIDE' as const, label: 'Sitewide' },
            { id: 'USAGE' as const, label: 'Usage' },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`disc-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`disc-panel-${t.id}`}
            className={tab === t.id ? 'dash-btn-primary' : 'dash-btn-secondary'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`disc-panel-${tab}`} aria-labelledby={`disc-tab-${tab}`}>
        {tab === 'CODES' && <CodesPanel onChanged={bump} refreshToken={refreshToken} />}
        {tab === 'SITEWIDE' && <SitewidePanel onChanged={bump} refreshToken={refreshToken} />}
        {tab === 'USAGE' && <UsagePanel refreshToken={refreshToken} />}
      </div>
    </>
  );
}
