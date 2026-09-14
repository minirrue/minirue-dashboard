'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import StrategyBar from './StrategyBar';
import PricesTab from './PricesTab';
import CostsTab from './CostsTab';
import GrowthTab from './GrowthTab';
import WarningsTab from './WarningsTab';
import './accounting.css';

export const ACCOUNTING_TABS = [
  { id: 'prices', label: 'Prices', Panel: PricesTab },
  { id: 'costs', label: 'Costs & rules', Panel: CostsTab },
  { id: 'growth', label: 'Growth', Panel: GrowthTab },
  { id: 'warnings', label: 'Warnings', Panel: WarningsTab },
] as const;

export type AccountingTab = (typeof ACCOUNTING_TABS)[number]['id'];

function toTab(raw: string | null): AccountingTab {
  return ACCOUNTING_TABS.find((t) => t.id === raw)?.id ?? 'prices';
}

/**
 * Accounting section shell (minirue-dashboard#56). The URL is the only tab
 * state, so a link such as a warning's `/accounting?tab=warnings` lands on the
 * right tab and the back button behaves.
 */
export default function AccountingClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = toTab(params.get('tab'));
  const [repriced, setRepriced] = useState(0);

  const selectTab = useCallback(
    (next: AccountingTab) => {
      const qs = new URLSearchParams(params.toString());
      qs.set('tab', next);
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const active = ACCOUNTING_TABS.find((t) => t.id === tab) ?? ACCOUNTING_TABS[0];
  const { Panel } = active;

  return (
    <div className="acct">
      <div className="dash-page-header acct-header">
        <div>
          <h1 className="dash-page-title">Accounting</h1>
          <p className="dash-page-subtitle">
            What each item costs you, what it should sell for, and what every order earns.
          </p>
        </div>
      </div>

      {/* A reprice changes prices and the saved block, so the open tab remounts and refetches. */}
      <StrategyBar onRepriced={() => setRepriced((n) => n + 1)} />

      <div role="tablist" aria-label="Accounting view" className="dash-tabstrip acct-tabs">
        {ACCOUNTING_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`acct-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`acct-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? 'dash-btn-primary' : 'dash-btn-secondary'}
            onClick={() => selectTab(t.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              const i = ACCOUNTING_TABS.findIndex((x) => x.id === t.id);
              const step = e.key === 'ArrowRight' ? 1 : -1;
              const next = ACCOUNTING_TABS[(i + step + ACCOUNTING_TABS.length) % ACCOUNTING_TABS.length];
              selectTab(next.id);
              document.getElementById(`acct-tab-${next.id}`)?.focus();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`acct-panel-${tab}`} aria-labelledby={`acct-tab-${tab}`}>
        <Panel key={repriced} />
      </div>
    </div>
  );
}
