import { isKnownDashboardPath } from '@/lib/auth/roles';

/**
 * A notification's stored `link` is free-form and was rendered straight into
 * `<Link href>`.
 *
 * Every link the templates write is a real dashboard route, but the column is
 * writable by any caller of the create endpoint. A row naming a path this app
 * has no page for navigated to a hard 404 — reported 2026-08-21 as the
 * Notifications tab "crashing to /logout", which exists nowhere in this repo.
 */
describe('isKnownDashboardPath', () => {
  it('accepts real dashboard routes, with or without a child segment', () => {
    expect(isKnownDashboardPath('/orders')).toBe(true);
    expect(isKnownDashboardPath('/orders/abc-123')).toBe(true);
    expect(isKnownDashboardPath('/support?c=42')).toBe(true);
    expect(isKnownDashboardPath('/catalogue/brands')).toBe(true);
  });

  it('rejects a path the dashboard does not serve', () => {
    // The exact URL from the report.
    expect(isKnownDashboardPath('/logout')).toBe(false);
    expect(isKnownDashboardPath('/nope')).toBe(false);
  });

  it('rejects anything that could leave the dashboard', () => {
    expect(isKnownDashboardPath('//evil.example.com')).toBe(false);
    expect(isKnownDashboardPath('https://evil.example.com/orders')).toBe(false);
    expect(isKnownDashboardPath('orders')).toBe(false);
  });
});
