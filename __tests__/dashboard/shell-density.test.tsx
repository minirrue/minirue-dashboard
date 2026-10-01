import { render, screen } from '@testing-library/react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import DashboardTopbar from '@/components/dashboard/DashboardTopbar';
import { CollabPageHeader } from '@/components/collab/collab-ui';
import { Role } from '@/lib/auth/role';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

jest.mock('@/lib/hooks/use-shop-name', () => ({ useShopName: () => 'MiniRue' }));
jest.mock('@/lib/hooks/use-notification-counts', () => ({ useNotificationCounts: () => ({ byCategory: {} }) }));
jest.mock('@/lib/hooks/use-unread-notifications', () => ({ useUnreadNotificationCount: () => [0, jest.fn()] }));
jest.mock('@/lib/hooks/use-pricing-warnings', () => ({ usePricingWarnings: () => ({ total: 0 }) }));
jest.mock('@/components/dashboard/NotificationDrawer', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/dashboard/ServerStatus', () => ({ __esModule: true, default: () => <span>Server online</span> }));
jest.mock('@/components/dashboard/UserMenu', () => ({ __esModule: true, default: () => <button>Account</button> }));
jest.mock('@/components/dashboard/PricingWarningsLink', () => ({
  __esModule: true,
  default: () => null,
  IconWarningTriangle: () => null,
  pricingWarningsLabel: () => 'Pricing warnings',
}));

describe('compact dashboard shell contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  });

  it('removes dashboard branding from both navigation surfaces while retaining navigation controls', () => {
    const { container } = render(
      <DashboardShell userName="Youssef" userRole={Role.ADMIN} activePath="/orders">
        <p>Work area</p>
      </DashboardShell>,
    );

    expect(screen.queryByText('MiniRue')).toBeNull();
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(container.querySelector('.dash-sidebar-logo-compact')).toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle navigation menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll('button')).filter((button) => button.textContent === 'Account')).toHaveLength(2);
  });

  it('renders an optional search trigger once in the shared utility header', () => {
    render(
      <DashboardShell
        userName="Youssef"
        userRole={Role.ADMIN}
        activePath="/orders"
        searchTrigger={<button type="button">Search dashboard</button>}
      >
        <p>Work area</p>
      </DashboardShell>,
    );

    const trigger = screen.getByRole('button', { name: 'Search dashboard' });
    expect(trigger.closest('.dash-topbar-search-slot')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Search dashboard' })).toHaveLength(1);
  });

  it('renders a single visible collab page heading with a subtitle and action', () => {
    render(<DashboardShell userRole={Role.STAFF} activePath="/collab/workspace"><CollabPageHeader title="Workspace" subtitle="Your activity" action={<button>Refresh</button>} /></DashboardShell>);
    expect(screen.getAllByRole('heading', { level: 1, name: 'Workspace' })).toHaveLength(1);
    expect(screen.getByText('Your activity')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });

  it('renders the supplied collab title even without subtitle or action', () => {
    render(<CollabPageHeader title="My products" />);
    expect(screen.getByRole('heading', { level: 1, name: 'My products' })).toBeVisible();
  });

  it('does not render an inert search affordance when no trigger is supplied', () => {
    const { container } = render(<DashboardTopbar />);
    expect(container.querySelector('.dash-topbar-search-slot')).toBeNull();
    expect(screen.queryByRole('button', { name: /search/i })).toBeNull();
  });
});
