import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

/**
 * minirue-backend#103 — a sitewide offer is either Automatic (today: applies to
 * every bag) or a Manual code the shopper types at checkout. For Manual the
 * admin names the code; it is saved UPPERCASE with single spaces, shown that
 * way live while typing, and gets percent, dates and usage limits.
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

jest.mock('@/lib/api/accounting', () => ({
  apiOfferImpact: jest.fn(),
}));

import SitewidePanel from '@/app/dashboard/discounts/SitewidePanel';
import ImpactCodesPanel from '@/app/dashboard/discounts/CodesPanel';
import { apiOfferImpact, type OfferImpact } from '@/lib/api/accounting';
import {
  createDiscount,
  killDiscount,
  listDiscounts,
  setAutomatic,
  type Discount,
} from '@/lib/api/discounts';
import { codeNameProblem, formatCodeName } from '@/lib/discounts/code-name';
import { startOfShopDayIso } from '@/lib/dates/end-of-shop-day';

const mockList = listDiscounts as jest.Mock;
const mockCreate = createDiscount as jest.Mock;
const mockSetAutomatic = setAutomatic as jest.Mock;
const mockKill = killDiscount as jest.Mock;
const mockImpact = apiOfferImpact as jest.Mock;

/** The real `GET /v1/accounting/offers/impact` shape (backend#164). */
function impact(percentBp: number, capped: number, belowLaw1: number): OfferImpact {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `p-${i + 1}`);
  return {
    percentBp,
    productId: null,
    capped: ids(capped).map((productId, i) => ({
      variantId: `v-${i + 1}`,
      productId,
      productName: `Product ${i + 1}`,
      sku: `SKU-${i + 1}`,
      priceMinor: 80900,
      offerPriceMinor: 65900,
      realPercentBp: 1854,
    })),
    cappedProductCount: capped,
    belowLaw1: ids(belowLaw1).map((productId, i) => ({
      variantId: `v-${i + 1}`,
      productId,
      offerPriceMinor: 65900,
    })),
    belowLaw1ProductCount: belowLaw1,
  };
}

const IMPACT_LINE = /capped at their floor|below Law 1/;

function discount(over: Partial<Discount>): Discount {
  return {
    id: 'd-' + Math.random().toString(36).slice(2),
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

const LIVE_MANUAL = discount({ id: 'manual-1', code: 'EID SALE', percent: 20, maxRedemptions: 50, usedCount: 3 });
const PER_ITEM = discount({ id: 'item-1', code: 'LIPSTICK5', productId: 'p-1' });
const PERSONAL = discount({ id: 'mine-1', code: 'MINIRUE-K7P2X4', kind: 'PERSONAL', ownerCustomerId: 'c-1' });

beforeEach(() => {
  jest.clearAllMocks();
  // By argument (lesson dashboard#38): the panel asks for live rows only.
  mockList.mockImplementation(async (includeKilled: boolean) =>
    includeKilled ? [] : [LIVE_MANUAL, PER_ITEM, PERSONAL],
  );
  mockCreate.mockImplementation(async (input: { code: string }) =>
    discount({ id: 'new', code: input.code }),
  );
  mockSetAutomatic.mockResolvedValue(discount({ kind: 'AUTOMATIC' }));
  mockKill.mockResolvedValue(discount({}));
  // By argument: nothing is affected below 20%, 3 capped and 2 under Law 1 above.
  mockImpact.mockImplementation(async ({ percentBp }: { percentBp: number }) =>
    percentBp >= 2000 ? impact(percentBp, 3, 2) : impact(percentBp, 0, 0),
  );
});

function mode(name: RegExp) {
  return screen.getByRole('radio', { name });
}

describe('code name rules — mirror the backend normaliser', () => {
  it('uppercases and collapses spaces', () => {
    expect(formatCodeName('summer  sale')).toBe('SUMMER SALE');
    expect(formatCodeName('  Summer Sale 20 ')).toBe('SUMMER SALE 20');
    expect(formatCodeName('miniRue-10')).toBe('MINIRUE10');
  });

  it('names what is wrong, or nothing', () => {
    expect(codeNameProblem('SUMMER SALE')).toBeNull();
    expect(codeNameProblem('ab')).toMatch(/at least 3/);
    expect(codeNameProblem('A'.repeat(25))).toMatch(/24/);
    expect(codeNameProblem('AB '.repeat(12))).toMatch(/32/);
  });

  it('a start date is the first instant of that day in Cairo', () => {
    expect(startOfShopDayIso('2026-10-01')).toBe('2026-09-30T21:00:00.000Z');
    expect(startOfShopDayIso('2026-12-01')).toBe('2026-11-30T22:00:00.000Z');
    expect(startOfShopDayIso('nope')).toBeNull();
  });
});

describe('SitewidePanel — Automatic / Manual code', () => {
  it('Automatic is the default and behaves exactly as before', async () => {
    render(<SitewidePanel onChanged={jest.fn()} refreshToken={0} />);
    await waitFor(() => expect(mockList).toHaveBeenCalledWith(false));

    expect(mode(/automatic/i)).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(screen.getByLabelText('Percent off'), { target: { value: '12' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    });

    expect(mockSetAutomatic).toHaveBeenCalledWith({ percent: 12, expiresAt: null, note: 'Campaign' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('Manual shows the code uppercase as it is typed, and creates a whole-bag code', async () => {
    render(<SitewidePanel onChanged={jest.fn()} refreshToken={0} />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    fireEvent.click(mode(/manual code/i));
    expect(mode(/manual code/i)).toHaveAttribute('aria-checked', 'true');

    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'summer  sale' } });
    expect(screen.getByTestId('code-name-preview')).toHaveTextContent('SUMMER SALE');

    fireEvent.change(screen.getByLabelText('Percent off'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-10-07' } });
    fireEvent.change(screen.getByLabelText('Total uses'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Uses per customer'), { target: { value: '2' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    });

    expect(mockCreate).toHaveBeenCalledWith({
      kind: 'GLOBAL',
      valueType: 'PERCENT',
      percent: 15,
      code: 'SUMMER SALE',
      productId: null,
      ownerCustomerId: null,
      startsAt: '2026-09-30T21:00:00.000Z',
      expiresAt: '2026-10-07T20:59:59.999Z',
      maxRedemptions: 100,
      maxPerCustomer: 2,
      note: 'Campaign',
    });
    expect(mockSetAutomatic).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Created/)).toHaveTextContent('SUMMER SALE'));
  });

  it('refuses to submit a code name the server would refuse', async () => {
    render(<SitewidePanel onChanged={jest.fn()} refreshToken={0} />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    fireEvent.click(mode(/manual code/i));

    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'ab' } });

    expect(screen.getByText(/at least 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create code' })).toBeDisabled();
  });

  it('refuses an end date before the start date', async () => {
    render(<SitewidePanel onChanged={jest.fn()} refreshToken={0} />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    fireEvent.click(mode(/manual code/i));

    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'EID' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-10-07' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-10-01' } });

    expect(screen.getByRole('button', { name: 'Create code' })).toBeDisabled();
    expect(screen.getByText(/ends before it starts/i)).toBeInTheDocument();
  });

  it('requires a note for Other and stores the explanation in the legacy note field', async () => {
    render(<SitewidePanel onChanged={jest.fn()} refreshToken={0} />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('radio', { name: 'Other' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText(/explain the discount/i)).toBeInTheDocument();
    expect(mockSetAutomatic).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Explain the discount'), {
      target: { value: 'VIP apology week' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    });
    expect(mockSetAutomatic).toHaveBeenCalledWith({
      percent: 10,
      expiresAt: null,
      note: 'VIP apology week',
    });
  });

  it('lists live manual sitewide codes only — not per-item or personal codes — and can stop one', async () => {
    render(<SitewidePanel onChanged={jest.fn()} refreshToken={0} />);
    fireEvent.click(mode(/manual code/i));

    const running = await screen.findByRole('table', { name: /manual sitewide codes/i });
    expect(within(running).getByText('EID SALE')).toBeInTheDocument();
    expect(within(running).queryByText('LIPSTICK5')).not.toBeInTheDocument();
    expect(within(running).queryByText('MINIRUE-K7P2X4')).not.toBeInTheDocument();
    expect(within(running).getByText('3 / 50')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(running).getByRole('button', { name: 'Stop EID SALE' }));
    });
    expect(mockKill).toHaveBeenCalledWith('manual-1');
  });
});

describe('CodesPanel — the code name and start date (backend#103 audit)', () => {
  // Imported here so the SitewidePanel cases above do not depend on it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const CodesPanel = require('@/app/dashboard/discounts/CodesPanel').default;

  it('sends a named code in its saved form, with its start date', async () => {
    render(<CodesPanel onChanged={jest.fn()} refreshToken={0} />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'eid  offer' } });
    expect(screen.getByTestId('codes-code-preview')).toHaveTextContent('EID OFFER');
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-10-01' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'EID OFFER',
        startsAt: '2026-09-30T21:00:00.000Z',
      }),
    );
  });

  it('still generates the code when the name is left blank', async () => {
    render(<CodesPanel onChanged={jest.fn()} refreshToken={0} />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('code');
  });
});

describe('offer impact line (dashboard#63, backend#164)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  async function settle(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }

  it('Sitewide: debounces typing into one impact call and shows both counts', async () => {
    render(<SitewidePanel onChanged={jest.fn()} refreshToken={0} />);
    const input = screen.getByLabelText('Percent off');

    fireEvent.change(input, { target: { value: '2' } });
    await settle(200);
    fireEvent.change(input, { target: { value: '25' } });
    await settle(399);
    expect(mockImpact).not.toHaveBeenCalled();

    await settle(1);
    expect(mockImpact).toHaveBeenCalledTimes(1);
    expect(mockImpact).toHaveBeenCalledWith({ percentBp: 2500 });
    expect(
      await screen.findByText(
        '3 products will be capped at their floor · 2 dip below Law 1 (profit from the delivery fee)',
      ),
    ).toBeInTheDocument();
  });

  it('Sitewide: shows nothing when both counts are 0', async () => {
    render(<SitewidePanel onChanged={jest.fn()} refreshToken={0} />);
    fireEvent.change(screen.getByLabelText('Percent off'), { target: { value: '25' } });
    await settle(400);
    await screen.findByText(IMPACT_LINE);

    fireEvent.change(screen.getByLabelText('Percent off'), { target: { value: '15' } });
    await settle(400);
    expect(mockImpact).toHaveBeenLastCalledWith({ percentBp: 1500 });
    await waitFor(() => expect(screen.queryByText(IMPACT_LINE)).not.toBeInTheDocument());
  });

  it('Sitewide: a failed impact call never blocks saving', async () => {
    mockImpact.mockRejectedValue(new Error('offline'));
    render(<SitewidePanel onChanged={jest.fn()} refreshToken={0} />);
    fireEvent.change(screen.getByLabelText('Percent off'), { target: { value: '25' } });
    await settle(400);

    expect(mockImpact).toHaveBeenCalled();
    expect(screen.queryByText(IMPACT_LINE)).not.toBeInTheDocument();
    const start = await screen.findByRole('button', { name: 'Start' });
    expect(start).toBeEnabled();
    await act(async () => {
      fireEvent.click(start);
    });
    expect(mockSetAutomatic).toHaveBeenCalledWith({ percent: 25, expiresAt: null, note: 'Campaign' });
    expect(screen.queryByText(/offline/)).not.toBeInTheDocument();
  });

  it('Codes: shows the line for a percent code only, never for a fixed amount', async () => {
    render(<ImpactCodesPanel onChanged={jest.fn()} refreshToken={0} />);
    fireEvent.change(screen.getByLabelText('Percent'),{ target: { value: '25' } });
    await settle(400);
    expect(mockImpact).toHaveBeenCalledWith({ percentBp: 2500 });
    expect(await screen.findByText(IMPACT_LINE)).toHaveTextContent(
      '3 products will be capped at their floor · 2 dip below Law 1 (profit from the delivery fee)',
    );

    mockImpact.mockClear();
    fireEvent.change(screen.getByLabelText('Takes off'), { target: { value: 'FIXED' } });
    await settle(400);
    expect(screen.queryByText(IMPACT_LINE)).not.toBeInTheDocument();
    expect(mockImpact).not.toHaveBeenCalled();
  });
});
