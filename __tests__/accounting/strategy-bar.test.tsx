import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';

/**
 * PG-DASHBOARD-ACCTG-007 (minirue-dashboard#58). The strategy bar reprices on
 * release: one slider release sends exactly one PATCH of `{pricing:{strategyBp}}`,
 * the result line offers Undo, a 409 Undo explains itself, and the dollar rate
 * saves on Enter. `apiFetch` is mocked (not the accounting client) so the wire
 * shape backend#159 accepts is asserted too.
 */

jest.mock('@/lib/api/client', () => ({ apiFetch: jest.fn() }));

import { apiFetch } from '@/lib/api/client';
import StrategyBar from '@/app/dashboard/accounting/StrategyBar';

const mockFetch = apiFetch as jest.Mock;

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-14T12:00:00Z');

function pricing(over: Record<string, unknown> = {}) {
  return {
    fulfillmentItems: [],
    strategyBp: 3000,
    usdRate: { egpPerUsd: '50.85', setAt: new Date(NOW - 10 * DAY).toISOString() },
    guardrails: { minMarginBp: 1000, maxMarginBp: 8000 },
    classes: {},
    rounding: 'END_9',
    staleDays: 30,
    paybackOrders: 3,
    ...over,
  };
}

function overview(over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return { pricing: pricing(over), fees: {}, variants: [], sets: [], lastRun: null, undoableRunId: null, ...extra };
}

function run(id: string, changedCount: number, averageChangeBp: number | null, cause = 'STRATEGY') {
  return { id, cause, changedCount, averageChangeBp, createdAt: new Date(NOW).toISOString(), undoneAt: null, changes: [] };
}

function calls(method: string, path: string) {
  return mockFetch.mock.calls.filter(([p, init]) => p === path && (init?.method ?? 'GET') === method);
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockFetch.mockReset();
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

async function renderLoaded(onRepriced?: () => void) {
  mockFetch.mockImplementation((path: string) => {
    if (path === '/accounting/overview') return Promise.resolve(overview());
    return Promise.reject(new Error(`unexpected ${path}`));
  });
  render(<StrategyBar onRepriced={onRepriced} />);
  return (await screen.findByRole('slider', { name: /reach.*profit/i })) as HTMLInputElement;
}

describe('StrategyBar', () => {
  it('shows the saved position and sends exactly one PATCH when the slider is released', async () => {
    const onRepriced = jest.fn();
    const slider = await renderLoaded(onRepriced);
    expect(slider.value).toBe('30');
    expect(slider).toHaveAttribute('aria-valuetext', '30% toward profit');

    let resolvePatch: (v: unknown) => void = () => {};
    mockFetch.mockImplementation((path: string) => {
      if (path === '/accounting/settings') return new Promise((r) => (resolvePatch = r));
      return Promise.reject(new Error(`unexpected ${path}`));
    });

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '40' } });
    fireEvent.change(slider, { target: { value: '55' } });
    fireEvent.change(slider, { target: { value: '60' } });
    expect(calls('PATCH', '/accounting/settings')).toHaveLength(0);
    expect(screen.getByText('60% toward profit')).toBeInTheDocument();

    fireEvent.pointerUp(slider);
    fireEvent.keyUp(slider, { key: 'Shift' });
    fireEvent.blur(slider);

    const patches = calls('PATCH', '/accounting/settings');
    expect(patches).toHaveLength(1);
    expect(JSON.parse(patches[0][1].body)).toEqual({ pricing: { strategyBp: 6000 } });
    expect(slider).toBeDisabled();

    await act(async () => {
      resolvePatch({ run: run('run-1', 14, -310), overview: overview({ strategyBp: 6000 }, { undoableRunId: 'run-1' }) });
    });

    const line = await screen.findByText(/14 prices changed · average −3\.1%/);
    expect(line.closest('[aria-live]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(slider).not.toBeDisabled();
    expect(onRepriced).toHaveBeenCalledTimes(1);
    expect(calls('PATCH', '/accounting/settings')).toHaveLength(1);
  });

  it('commits a keyboard move on key-up', async () => {
    const slider = await renderLoaded();
    mockFetch.mockResolvedValue({ run: run('run-2', 3, 120), overview: overview({ strategyBp: 3500 }) });
    fireEvent.change(slider, { target: { value: '35' } });
    fireEvent.keyUp(slider, { key: 'ArrowRight' });
    await screen.findByText(/3 prices changed · average \+1\.2%/);
    expect(calls('PATCH', '/accounting/settings')).toHaveLength(1);
  });

  it('Undo calls the run undo route and shows the restored result', async () => {
    const onRepriced = jest.fn();
    const slider = await renderLoaded(onRepriced);
    mockFetch.mockResolvedValueOnce({ run: run('run-1', 14, -310), overview: overview({ strategyBp: 6000 }, { undoableRunId: 'run-1' }) });
    fireEvent.change(slider, { target: { value: '60' } });
    fireEvent.pointerUp(slider);
    const undo = await screen.findByRole('button', { name: 'Undo' });

    mockFetch.mockResolvedValueOnce({ run: run('run-u', 14, 320, 'UNDO'), undoneRunId: 'run-1', overview: overview() });
    fireEvent.click(undo);

    await screen.findByText(/Undone · 14 prices changed · average \+3\.2%/);
    expect(calls('POST', '/accounting/runs/run-1/undo')).toHaveLength(1);
    expect(slider.value).toBe('30');
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(onRepriced).toHaveBeenCalledTimes(2);
  });

  it('a 409 from Undo says prices were edited since', async () => {
    const slider = await renderLoaded();
    mockFetch.mockResolvedValueOnce({ run: run('run-1', 2, 50), overview: overview({ strategyBp: 6000 }, { undoableRunId: 'run-1' }) });
    fireEvent.change(slider, { target: { value: '60' } });
    fireEvent.pointerUp(slider);
    const undo = await screen.findByRole('button', { name: 'Undo' });

    mockFetch.mockRejectedValueOnce({ status: 409, message: 'Prices were edited since' });
    fireEvent.click(undo);

    await screen.findByText('Prices were edited since — Undo unavailable');
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('a failed save puts the slider back and says nothing changed', async () => {
    const slider = await renderLoaded();
    mockFetch.mockRejectedValueOnce({ status: 500, message: 'Server exploded' });
    fireEvent.change(slider, { target: { value: '80' } });
    fireEvent.pointerUp(slider);
    await screen.findByText(/Could not reprice: Server exploded\. Nothing changed\./);
    expect(slider.value).toBe('30');
  });

  it('saves the dollar rate once on Enter and shows how long ago it was set', async () => {
    await renderLoaded();
    expect(screen.getByText('set 10 days ago')).toBeInTheDocument();
    const rate = screen.getByRole('textbox', { name: /egp per 1 usd/i }) as HTMLInputElement;

    mockFetch.mockResolvedValueOnce({
      run: run('run-r', 9, 420, 'RATE'),
      overview: overview({ usdRate: { egpPerUsd: '52.10', setAt: new Date(NOW - 3 * DAY).toISOString() } }, { undoableRunId: 'run-r' }),
    });
    fireEvent.change(rate, { target: { value: ' 52.10 ' } });
    fireEvent.keyDown(rate, { key: 'Enter' });
    fireEvent.blur(rate);

    await screen.findByText('set 3 days ago');
    const patches = calls('PATCH', '/accounting/settings');
    expect(patches).toHaveLength(1);
    const body = JSON.parse(patches[0][1].body);
    expect(body.pricing.usdRate.egpPerUsd).toBe('52.10');
    expect(Object.keys(body.pricing)).toEqual(['usdRate']);
    expect(screen.getByText(/9 prices changed · average \+4\.2%/)).toBeInTheDocument();
  });

  it('refuses a rate that is not a number above 0 without saving', async () => {
    await renderLoaded();
    const rate = screen.getByRole('textbox', { name: /egp per 1 usd/i });
    fireEvent.change(rate, { target: { value: '0' } });
    fireEvent.keyDown(rate, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText(/Enter the rate as a number above 0/)).toBeInTheDocument());
    expect(calls('PATCH', '/accounting/settings')).toHaveLength(0);
  });
});
