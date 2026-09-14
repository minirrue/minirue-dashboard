import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/**
 * PG-DASHBOARD-ACCTG-004. The Accounting shell: four tabs driven by `?tab=`,
 * the StrategyBar above them, and an unknown tab falling back to Prices.
 */

const replace = jest.fn();
let search = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  usePathname: () => '/accounting',
  useSearchParams: () => search,
}));

import AccountingClient from '@/app/dashboard/accounting/AccountingClient';

afterEach(() => {
  cleanup();
  replace.mockClear();
});

describe('AccountingClient', () => {
  it('shows the four tabs and the strategy bar, Prices selected by default', () => {
    search = new URLSearchParams();
    render(<AccountingClient />);

    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Prices', 'Costs & rules', 'Growth', 'Warnings']);
    expect(screen.getByRole('tab', { name: 'Prices' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Pricing strategy' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'acct-tab-prices');
  });

  it('opens the tab named in ?tab=', () => {
    search = new URLSearchParams('tab=growth');
    render(<AccountingClient />);
    expect(screen.getByRole('tab', { name: 'Growth' })).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to Prices for an unknown ?tab=', () => {
    search = new URLSearchParams('tab=nope');
    render(<AccountingClient />);
    expect(screen.getByRole('tab', { name: 'Prices' })).toHaveAttribute('aria-selected', 'true');
  });

  it('writes ?tab= when a tab is clicked, keeping other params', () => {
    search = new URLSearchParams('row=v1');
    render(<AccountingClient />);
    fireEvent.click(screen.getByRole('tab', { name: 'Warnings' }));
    expect(replace).toHaveBeenCalledWith('/accounting?row=v1&tab=warnings', { scroll: false });
  });
});
