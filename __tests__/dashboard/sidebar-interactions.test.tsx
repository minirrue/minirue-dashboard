import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
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
jest.mock('@/components/dashboard/PricingWarningsLink', () => {
  const component = () => null;
  return {
    __esModule: true,
    default: component,
    IconWarningTriangle: () => null,
    pricingWarningsLabel: () => 'Pricing warnings',
  };
});

describe('collapsible dashboard navigation', () => {
  beforeEach(() => window.localStorage.clear());

  it('collapses with Ctrl+B and persists the choice for the signed-in user', async () => {
    const { container, unmount } = render(
      <DashboardShell userId="qa-admin" userName="Youssef" userRole={Role.ADMIN} activePath="/orders">
        <p>Orders</p>
      </DashboardShell>,
    );

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(container.querySelector('.dash-shell')).toHaveAttribute('data-sidebar-collapsed', 'true');
    expect(window.localStorage.getItem('minirue:dashboard-sidebar:qa-admin')).toBe('collapsed');

    unmount();
    const mountedAgain = render(
      <DashboardShell userId="qa-admin" userName="Youssef" userRole={Role.ADMIN} activePath="/orders">
        <p>Orders</p>
      </DashboardShell>,
    );
    await waitFor(() => expect(mountedAgain.container.querySelector('.dash-shell')).toHaveAttribute('data-sidebar-collapsed', 'true'));
  });

  it('collapses groups, persists them, and exposes rail labels as tooltips', () => {
    const { rerender } = render(
      <DashboardSidebar userId="qa-admin" userName="Youssef" userRole={Role.ADMIN} activePath="/orders" />,
    );
    const operations = screen.getByRole('button', { name: 'Operations' });
    fireEvent.click(operations);
    expect(operations).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem('minirue:dashboard-groups:qa-admin')).toContain('Operations');

    rerender(
      <DashboardSidebar userId="qa-admin" userName="Youssef" userRole={Role.ADMIN} activePath="/orders" collapsed />,
    );
    const orders = screen.getByRole('link', { name: 'Orders' });
    expect(orders).toHaveAttribute('data-tooltip', 'Orders');
    expect(orders).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: 'Open notifications' })).toBeVisible();
  });

  it('closes the mobile drawer with Escape', () => {
    const onClose = jest.fn();
    render(
      <DashboardSidebar
        userName="Youssef"
        userRole={Role.STAFF}
        activePath="/orders"
        mobileDrawerOpen
        onMobileDrawerClose={onClose}
      />,
    );
    const drawer = screen.getByRole('dialog', { name: 'Dashboard navigation' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    const accountButtons = screen.getAllByRole('button', { name: 'Account' });
    expect(accountButtons[accountButtons.length - 1]).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the closed mobile drawer out of keyboard navigation', () => {
    const { container } = render(
      <DashboardSidebar
        userName="Youssef"
        userRole={Role.STAFF}
        activePath="/orders"
        mobileDrawerOpen={false}
      />,
    );

    const drawer = container.querySelector('.dash-mobile-drawer');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(drawer).toHaveAttribute('inert');
  });
});
