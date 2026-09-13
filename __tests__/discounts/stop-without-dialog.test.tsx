import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

/**
 * dashboard#47 — owner, 2026-08-21: "remove alert, when I tap stop it stops
 * directly." Codes → Stop used a blocking window.prompt for a reason (and
 * aborted on a blank answer); Sitewide → Stop it used window.confirm. Both now
 * stop on the tap: the row flips at once and an error puts it back.
 */

jest.mock('@/lib/api/discounts', () => {
  const actual = jest.requireActual('@/lib/api/discounts');
  return {
    ...actual,
    listDiscounts: jest.fn(),
    createDiscount: jest.fn(),
    setAutomatic: jest.fn(),
    stopAutomatic: jest.fn(),
    killDiscount: jest.fn(),
  };
});

import CodesPanel from '@/app/dashboard/discounts/CodesPanel';
import SitewidePanel from '@/app/dashboard/discounts/SitewidePanel';
import {
  killDiscount,
  listDiscounts,
  stopAutomatic,
  type Discount,
} from '@/lib/api/discounts';

const mockList = listDiscounts as jest.Mock;
const mockKill = killDiscount as jest.Mock;
const mockStopAutomatic = stopAutomatic as jest.Mock;

function discount(over: Partial<Discount>): Discount {
  return {
    id: 'd-x',
    code: null,
    kind: 'GLOBAL',
    valueType: 'PERCENT',
    percent: 10,
    amountMinor: null,
    productId: null,
    ownerCustomerId: null,
    maxRedemptions: null,
    maxPerCustomer: 1,
    usedCount: 0,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    killedAt: null,
    killReason: null,
    source: 'DASHBOARD',
    supportConversationId: null,
    note: null,
    createdAt: '2026-09-13T10:00:00.000Z',
    ...over,
  };
}

let promptSpy: jest.SpyInstance;
let confirmSpy: jest.SpyInstance;
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  // If anything still asks, the answer would let the action through — so a
  // passing test cannot be a dialog that was shown and accepted.
  promptSpy = jest.spyOn(window, 'prompt').mockImplementation(() => 'reason');
  confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
  alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  promptSpy.mockRestore();
  confirmSpy.mockRestore();
  alertSpy.mockRestore();
});

function expectNoDialogs() {
  expect(promptSpy).not.toHaveBeenCalled();
  expect(confirmSpy).not.toHaveBeenCalled();
  expect(alertSpy).not.toHaveBeenCalled();
}

describe('Codes → Stop', () => {
  const CODE = discount({ id: 'code-1', code: 'MINIRUE-K7P2X4' });

  it('stops on the tap with no prompt and no reason', async () => {
    let killed = false;
    mockList.mockImplementation(async (includeKilled: boolean) =>
      killed && !includeKilled ? [] : [killed ? { ...CODE, killedAt: '2026-09-13T11:00:00.000Z' } : CODE],
    );
    mockKill.mockImplementation(async () => {
      killed = true;
      return { ...CODE, killedAt: '2026-09-13T11:00:00.000Z' };
    });

    render(<CodesPanel onChanged={() => undefined} refreshToken={0} />);
    const row = (await screen.findByText('MINIRUE-K7P2X4')).closest('tr')!;

    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: /stop/i }));
    });

    expect(mockKill).toHaveBeenCalledTimes(1);
    expect(mockKill).toHaveBeenCalledWith('code-1');
    expectNoDialogs();
  });

  it('shows the row as stopped before the server answers, and puts it back on failure', async () => {
    mockList.mockImplementation(async () => [CODE]);
    let reject!: (e: Error) => void;
    mockKill.mockImplementation(
      () => new Promise((_, r) => {
        reject = r;
      }),
    );

    render(<CodesPanel onChanged={() => undefined} refreshToken={0} />);
    const row = (await screen.findByText('MINIRUE-K7P2X4')).closest('tr')!;

    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: /stop/i }));
    });
    // Optimistic: no Stop button left on the row while the request is out.
    expect(within(row).queryByRole('button', { name: /^stop/i })).toBeNull();
    expect(within(row).getByText(/stopp/i)).toBeInTheDocument();

    await act(async () => {
      reject(new Error('network down'));
    });

    await waitFor(() =>
      expect(within(row).getByRole('button', { name: /stop/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/network down|could not stop/i)).toBeInTheDocument();
    expectNoDialogs();
  });
});

describe('Sitewide → Stop it', () => {
  it('stops the automatic offer on the tap with no confirm', async () => {
    const AUTO = discount({ id: 'auto-1', kind: 'AUTOMATIC', percent: 15 });
    let stopped = false;
    mockList.mockImplementation(async () => (stopped ? [] : [AUTO]));
    mockStopAutomatic.mockImplementation(async () => {
      stopped = true;
      return { stopped: 1 };
    });

    render(<SitewidePanel onChanged={() => undefined} refreshToken={0} />);
    const button = await screen.findByRole('button', { name: /stop it/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockStopAutomatic).toHaveBeenCalledTimes(1);
    await screen.findByText(/nothing running/i);
    expectNoDialogs();
  });
});
