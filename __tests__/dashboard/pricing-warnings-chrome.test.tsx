import { render, screen, within, cleanup } from '@testing-library/react';

/**
 * DA-5a (minirue-dashboard#60). The yellow pricing-warnings count sits beside
 * the bell (topbar on mobile, sidebar brand on desktop) and on the Accounting
 * nav item. All of them read usePricingWarnings, so they show the same number,
 * and with 0 warnings none of them renders.
 */

jest.mock('@/lib/hooks/use-pricing-warnings', () => ({ usePricingWarnings: jest.fn() }));
jest.mock('@/lib/hooks/use-unread-notifications', () => ({
  useUnreadNotificationCount: () => [2, jest.fn()],
}));
jest.mock('@/lib/hooks/use-notification-counts', () => ({
  // ADMIN unread in a real category, so the red nav pill is on screen too.
  useNotificationCounts: () => ({ unreadCount: 2, byCategory: { SUPPORT: 2 }, loaded: true }),
}));
jest.mock('@/lib/hooks/use-shop-name', () => ({ useShopName: () => 'MiniRue' }));
jest.mock('@/lib/api/collab-portal', () => ({ apiCollabOverview: jest.fn() }));
jest.mock('@/components/dashboard/NotificationDrawer', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/dashboard/ServerStatus', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/dashboard/UserMenu', () => ({ __esModule: true, default: () => null }));

import { usePricingWarnings } from '@/lib/hooks/use-pricing-warnings';
import DashboardTopbar from '@/components/dashboard/DashboardTopbar';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';
import { NOTIFICATION_CATEGORIES } from '@/lib/api/notifications';

const mockWarnings = usePricingWarnings as jest.Mock;

function withTotal(total: number) {
  mockWarnings.mockReturnValue({
    total,
    byProduct: {},
    items: [],
    isLoading: false,
    isError: false,
    recheck: jest.fn(),
  });
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('pricing warnings in the topbar', () => {
  it('shows a yellow triangle with the count, linking to the Warnings tab', () => {
    withTotal(3);
    render(<DashboardTopbar />);

    const link = screen.getByRole('link', { name: '3 pricing warnings' });
    expect(link).toHaveAttribute('href', '/accounting?tab=warnings');
    expect(link).toHaveTextContent('3');
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('sits next to the bell', () => {
    withTotal(3);
    render(<DashboardTopbar />);

    const link = screen.getByRole('link', { name: '3 pricing warnings' });
    const bell = screen.getByRole('button', { name: /open notifications/i });
    expect(link.parentElement).toBe(bell.parentElement);
  });

  it('renders nothing with 0 warnings', () => {
    withTotal(0);
    render(<DashboardTopbar />);
    expect(screen.queryByRole('link', { name: /pricing warning/ })).toBeNull();
  });

  it('says "1 pricing warning" in the singular', () => {
    withTotal(1);
    render(<DashboardTopbar />);
    expect(screen.getByRole('link', { name: '1 pricing warning' })).toBeInTheDocument();
  });

  it('caps the visible count at 99+', () => {
    withTotal(140);
    render(<DashboardTopbar />);
    expect(screen.getByRole('link', { name: '140 pricing warnings' })).toHaveTextContent('99+');
  });
});

describe('pricing warnings in the sidebar', () => {
  function accountingLinks() {
    return screen.getAllByRole('link', { name: /^Accounting/ });
  }

  it('badges the Accounting item with the same count, styled apart from the unread pill', () => {
    withTotal(3);
    render(<DashboardSidebar userRole="ADMIN" activePath="/overview" />);

    // Desktop sidebar and mobile drawer both render the nav.
    const links = accountingLinks();
    expect(links).toHaveLength(2);
    for (const link of links) {
      const badge = within(link).getByLabelText('3 pricing warnings');
      expect(badge).toHaveTextContent('3');
      expect(badge).toHaveClass('dash-sidebar-link-warn');
      expect(badge).not.toHaveClass('dash-sidebar-link-count');
      // No red unread pill on Accounting: PRICING is not mapped in nav-counts.
      expect(link.querySelector('.dash-sidebar-link-count')).toBeNull();
    }
    // The red pill still exists elsewhere, so the two are distinguishable.
    expect(screen.getAllByLabelText('2 unread in Chat').length).toBeGreaterThan(0);
  });

  it('puts the triangle beside the desktop bell too', () => {
    withTotal(3);
    render(<DashboardSidebar userRole="ADMIN" activePath="/overview" />);

    const triangles = screen
      .getAllByRole('link', { name: '3 pricing warnings' })
      .filter((el) => el.getAttribute('href') === '/accounting?tab=warnings');
    expect(triangles).toHaveLength(1);
    const bell = screen.getByRole('button', { name: /open notifications/i });
    expect(triangles[0].parentElement).toBe(bell.parentElement);
  });

  it('renders neither badge nor triangle with 0 warnings', () => {
    withTotal(0);
    render(<DashboardSidebar userRole="ADMIN" activePath="/overview" />);
    expect(screen.queryAllByLabelText(/pricing warning/)).toHaveLength(0);
  });
});

describe('PRICING notification category', () => {
  it('is a known category', () => {
    expect(NOTIFICATION_CATEGORIES).toContain('PRICING');
  });

  it('is not mapped to any nav item, so Accounting never shows a second number', () => {
    for (const categories of Object.values(HREF_CATEGORIES)) {
      expect(categories).not.toContain('PRICING');
    }
  });
});
