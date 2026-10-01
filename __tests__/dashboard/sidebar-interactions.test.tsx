import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn(),
    });
  });

  it('makes the page inert while the drawer is open and restores it on close', () => {
    const { container, rerender } = render(<div><main className="dash-main"><button>Page action</button></main><DashboardSidebar userRole={Role.STAFF} mobileDrawerOpen /></div>);
    const main = container.querySelector<HTMLElement>('.dash-main')!;
    expect(main.inert).toBe(true);
    rerender(<div><main className="dash-main"><button>Page action</button></main><DashboardSidebar userRole={Role.STAFF} mobileDrawerOpen={false} /></div>);
    expect(main.inert).toBe(false);
  });

  it('closes the mobile drawer when the viewport switches to desktop', () => {
    let onChange: (() => void) | undefined;
    const media = { matches: false, addEventListener: jest.fn((_type, fn) => { onChange = fn; }), removeEventListener: jest.fn() };
    window.matchMedia = jest.fn().mockReturnValue(media);
    const onClose = jest.fn();
    render(<DashboardSidebar userRole={Role.STAFF} mobileDrawerOpen onMobileDrawerClose={onClose} />);
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
    media.matches = true;
    act(() => onChange?.());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('collapses with Ctrl+B and persists the choice for the signed-in user', async () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn(),
    });
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

  it('locks the page, traps focus, then restores the opener when Escape closes the drawer', async () => {
    render(
      <DashboardShell userName="Youssef" userRole={Role.STAFF} activePath="/orders">
        <button>Page action</button>
      </DashboardShell>,
    );
    const toggle = screen.getByRole('button', { name: 'Toggle navigation menu' });
    toggle.focus();
    fireEvent.click(toggle);

    const drawer = screen.getByRole('dialog', { name: 'Dashboard navigation' });
    const main = document.querySelector<HTMLElement>('.dash-main')!;
    expect(document.body.style.overflow).toBe('hidden');
    expect(main.inert).toBe(true);
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveFocus();

    const accountButtons = screen.getAllByRole('button', { name: 'Account' });
    accountButtons[accountButtons.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(drawer).toHaveAttribute('aria-hidden', 'true'));
    expect(document.body.style.overflow).toBe('');
    expect(main.inert).toBe(false);
    expect(toggle).toHaveFocus();
  });

  it.each(['Escape', 'button', 'backdrop'])(
    'returns focus to the visible hamburger after %s closes a drawer opened from a focused input',
    async (dismiss) => {
      const { container } = render(
        <DashboardShell userName="Youssef" userRole={Role.STAFF} activePath="/orders" searchTrigger={<input aria-label="Search dashboard" />}>
          <button>Page action</button>
        </DashboardShell>,
      );
      const search = screen.getByRole('textbox', { name: 'Search dashboard' });
      const toggle = screen.getByRole('button', { name: 'Toggle navigation menu' });
      search.focus();
      expect(search).toHaveFocus();
      fireEvent.click(toggle);
      const drawer = screen.getByRole('dialog', { name: 'Dashboard navigation' });
      const main = container.querySelector<HTMLElement>('.dash-main')!;
      expect(drawer).toHaveAttribute('aria-hidden', 'false');
      expect(main.inert).toBe(true);
      expect(document.body.style.overflow).toBe('hidden');

      if (dismiss === 'Escape') fireEvent.keyDown(document, { key: 'Escape' });
      else if (dismiss === 'button') fireEvent.click(screen.getByRole('button', { name: 'Close navigation menu' }));
      else fireEvent.click(container.querySelector('.dash-mobile-backdrop')!);

      await waitFor(() => expect(drawer).toHaveAttribute('aria-hidden', 'true'));
      expect(main.inert).toBe(false);
      expect(document.body.style.overflow).toBe('');
      expect(toggle).toHaveFocus();
    },
  );

  it('moves focus to the desktop collapse control when the mobile opener becomes hidden', async () => {
    render(
      <DashboardShell userName="Youssef" userRole={Role.STAFF} activePath="/orders">
        <p>Orders</p>
      </DashboardShell>,
    );
    const toggle = screen.getByRole('button', { name: 'Toggle navigation menu' });
    toggle.focus();
    fireEvent.click(toggle);
    toggle.style.display = 'none';

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveFocus());
  });

  it('closes the drawer when the active route changes', async () => {
    const { rerender } = render(
      <DashboardShell userName="Youssef" userRole={Role.STAFF} activePath="/orders">
        <p>Orders</p>
      </DashboardShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Dashboard navigation' })).toBeVisible();

    rerender(
      <DashboardShell userName="Youssef" userRole={Role.STAFF} activePath="/discounts">
        <p>Discounts</p>
      </DashboardShell>,
    );

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Dashboard navigation' })).toBeNull());
    expect(document.body.style.overflow).toBe('');
  });

  it('does not apply a persisted desktop rail preference on drawer-sized viewports', async () => {
    window.localStorage.setItem('minirue:dashboard-sidebar:qa-admin', 'collapsed');
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn(),
    });

    const { container } = render(
      <DashboardShell userId="qa-admin" userName="Youssef" userRole={Role.ADMIN} activePath="/orders">
        <p>Orders</p>
      </DashboardShell>,
    );

    await waitFor(() => expect(container.querySelector('.dash-shell')).not.toHaveAttribute('data-sidebar-collapsed'));
    expect(window.localStorage.getItem('minirue:dashboard-sidebar:qa-admin')).toBe('collapsed');
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
