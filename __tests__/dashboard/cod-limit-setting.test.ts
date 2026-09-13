import { codLimitFromInput, codLimitToInput } from '@/app/dashboard/settings/SettingsClient';

/**
 * The cash-on-delivery limit field (minirue-backend#105).
 *
 * There was no field: the limit was a hard-coded EGP 500 in the backend, so
 * every COD order over 500 was refused and nothing here could change it. The
 * owner's rule is that COD is allowed by default and a limit exists only when
 * set — so the one thing this mapping must never do is turn "blank" into 0,
 * which would refuse cash on delivery on every order.
 */
describe('COD limit field mapping', () => {
  it('sends a blank field as no limit (null), never as 0', () => {
    expect(codLimitFromInput('')).toBeNull();
    expect(codLimitFromInput('   ')).toBeNull();
  });

  it('sends a typed limit as whole minor units', () => {
    expect(codLimitFromInput('3000')).toBe(300_000);
    expect(codLimitFromInput('2499.99')).toBe(249_999);
  });

  it('keeps 0 as a real limit, distinct from blank', () => {
    expect(codLimitFromInput('0')).toBe(0);
    expect(codLimitToInput(0)).toBe('0.00');
  });

  it('shows no limit as an empty field', () => {
    expect(codLimitToInput(null)).toBe('');
    expect(codLimitToInput(undefined)).toBe('');
  });

  it('round-trips a stored limit through the field', () => {
    expect(codLimitFromInput(codLimitToInput(300_000))).toBe(300_000);
    expect(codLimitFromInput(codLimitToInput(null))).toBeNull();
  });

  it('treats a negative or unreadable entry as no limit rather than blocking COD', () => {
    expect(codLimitFromInput('-5')).toBeNull();
    expect(codLimitFromInput('abc')).toBeNull();
  });
});
