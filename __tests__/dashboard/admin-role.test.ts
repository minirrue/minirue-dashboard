import { isAdminRole } from '@/lib/auth/roles';

/**
 * Gates the latency readout. Getting this wrong in the permissive direction
 * shows operational detail to partners, so the negative cases matter more than
 * the positive ones.
 */
describe('isAdminRole', () => {
  it('is true for the two roles that run the shop', () => {
    expect(isAdminRole('SUPERADMIN')).toBe(true);
    expect(isAdminRole('ADMIN')).toBe(true);
  });

  it('is false for staff, partners and customers', () => {
    expect(isAdminRole('STAFF')).toBe(false);
    expect(isAdminRole('COLLAB')).toBe(false);
    expect(isAdminRole('CUSTOMER')).toBe(false);
  });

  it('is false before the role has resolved, not true', () => {
    // userRole is briefly undefined on every page refresh. Defaulting to
    // "admin" there would flash the latency at whoever is logged in.
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });

  it('is false for anything that is not a known role', () => {
    expect(isAdminRole('admin')).toBe(false);
    expect(isAdminRole('OWNER')).toBe(false);
    expect(isAdminRole('DEV')).toBe(false);
  });
});
