import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * 2026-07-30 owner ask: "when we create account for anything in super admin
 * make sure we set the first and last name, last name is optional." First
 * name is required, last name is optional — both should reach
 * createAccount(), which now persists them onto the account's own
 * customerProfiles row (AccountsService.create on the backend) instead of a
 * single free-text "Name" field.
 */

jest.mock('@/lib/api/platform', () => ({
  listAccounts: jest.fn(),
  createAccount: jest.fn(),
  updateAccount: jest.fn(),
  deleteAccount: jest.fn(),
  signInAsAccount: jest.fn(),
}));

import AdminAccountsClient from '@/app/dashboard/admin/AdminAccountsClient';
import { listAccounts, createAccount } from '@/lib/api/platform';

const mockList = listAccounts as jest.Mock;
const mockCreate = createAccount as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // AdminAccountsClient does mobile detection via matchMedia, which jsdom
  // doesn't implement.
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
  mockList.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25 });
  mockCreate.mockResolvedValue({
    id: 'acc-1',
    name: 'Sara',
    email: 'sara@example.com',
    role: 'STAFF',
    status: 'ACTIVE',
    createdAt: new Date(),
    isSelf: false,
  });
});

async function openCreateForm() {
  render(<AdminAccountsClient />);
  fireEvent.click(await screen.findByRole('button', { name: /add an account/i }));
}

describe('AdminAccountsClient — first/last name on create', () => {
  it('rejects submission with no first name (native required + disabled submit)', async () => {
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'sara@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password for the new account/i), {
      target: { value: 'longenoughpassword' },
    });

    // The submit button stays disabled until a first name is entered — this
    // is the form-level guarantee that a blank first name can never be sent.
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('accepts submission with a first name and no last name', async () => {
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'sara@example.com' } });
    fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: 'Sara' } });
    fireEvent.change(screen.getByLabelText(/^password for the new account/i), {
      target: { value: 'longenoughpassword' },
    });

    const submit = screen.getByRole('button', { name: /create account/i });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.firstName).toBe('Sara');
    expect(payload.lastName).toBeUndefined();
  });

  it('passes both names through when a last name is given', async () => {
    await openCreateForm();
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'sara@example.com' } });
    fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: 'Sara' } });
    fireEvent.change(screen.getByLabelText(/^last name/i), { target: { value: 'Youssef' } });
    fireEvent.change(screen.getByLabelText(/^password for the new account/i), {
      target: { value: 'longenoughpassword' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.firstName).toBe('Sara');
    expect(payload.lastName).toBe('Youssef');
  });
});
