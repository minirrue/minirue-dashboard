import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import MaintenancePanel from '@/components/dashboard/MaintenancePanel';
import { Role } from '@/lib/auth/role';

describe('MaintenancePanel', () => {
  it('says the section is under maintenance, not that access is denied', () => {
    render(<MaintenancePanel attemptedPath="/inventory" role={Role.ADMIN} />);
    expect(screen.getByText(/under maintenance/i)).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
  });

  it('offers a way back to somewhere that works', () => {
    render(<MaintenancePanel attemptedPath="/inventory" role={Role.ADMIN} />);
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
  });
});
