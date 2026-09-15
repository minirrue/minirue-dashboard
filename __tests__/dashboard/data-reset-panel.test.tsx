import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as platformApi from '@/lib/api/platform';
import * as clientApi from '@/lib/api/client';
import DataResetPanel from '@/components/dashboard/DataResetPanel';

/**
 * The confirmation phrase is now a fixed word ('DELETE') the server sends, so
 * in practice it is always present. The guard below still matters: it used to
 * be the shop's own name, a brand-new shop had none, and the panel called
 * .trim() on undefined and crashed the ENTIRE Settings page with "Cannot read
 * properties of undefined (reading 'trim')".
 *
 * A server that is stale, failing or mid-deploy can still answer with no
 * phrase, and the answer to that must stay "render, and refuse to erase" rather
 * than "take down the Settings page". These tests hold that line — the shop
 * name is gone from the wording, not the protection.
 */

jest.mock('@/lib/api/platform');
jest.mock('@/lib/api/client', () => ({ apiFetch: jest.fn() }));

const mockedPlatform = platformApi as jest.Mocked<typeof platformApi>;
const mockedApiFetch = clientApi.apiFetch as jest.MockedFunction<typeof clientApi.apiFetch>;

function previewWith(confirmationPhrase: unknown) {
  return {
    groups: [
      { key: 'sales', label: 'Orders', description: 'All orders', rowCount: 3, fileCount: 0, requires: [] },
    ],
    neverDeleted: ['users'],
    confirmationPhrase,
  } as unknown as platformApi.ResetPreview;
}

/** An empty shop — every group at zero, so there is nothing left to erase. */
function emptyPreview() {
  return {
    groups: [
      { key: 'sales', label: 'Orders', description: 'All orders', rowCount: 0, fileCount: 0, requires: [] },
    ],
    neverDeleted: ['users'],
    confirmationPhrase: 'DELETE',
  } as unknown as platformApi.ResetPreview;
}

function eraseButton() {
  return screen.getByRole('button', { name: /Erase everything except admin logins/i });
}

async function typeConfirmation() {
  fireEvent.change(await screen.findByLabelText(/to confirm/i), {
    target: { value: 'DELETE' },
  });
}

describe('DataResetPanel — missing confirmation phrase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders instead of crashing when the phrase is undefined', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith(undefined));
    render(<DataResetPanel />);
    // The heading proves the panel mounted rather than throwing to the boundary.
    expect(await screen.findByText(/Erase shop data/i)).toBeInTheDocument();
  });

  it('blocks the wipe and explains why when the phrase is empty', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith(''));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    expect(
      screen.getByText(/confirmation phrase is unavailable/i),
    ).toBeInTheDocument();
    // No confirm input is offered — there is nothing to type.
    expect(screen.queryByLabelText(/to confirm/i)).not.toBeInTheDocument();
    expect(eraseButton()).toBeDisabled();
  });

  it('shows the normal confirm input when a phrase is present', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    expect(await screen.findByLabelText(/to confirm/i)).toBeInTheDocument();
  });
});

/**
 * Owner, twice: "erase ticked data isnt working" (2026-08-24), then remove the
 * tick boxes entirely and leave one check.
 *
 * The thirteen per-group checkboxes are gone from this screen. What is left has
 * to be unmistakable: one button, one gate, and a sentence next to the button
 * saying why it cannot fire yet — because a dead button with the reason a
 * screen away is what caused the first report.
 */
describe('DataResetPanel — one action, one gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /*
   * Updated deliberately for minirue-dashboard#71. #23 asserted the tick boxes
   * were gone; the owner uses selective erase, so they are back — but only in
   * the "Choose what to erase" mode, never tucked in a collapsed section. In
   * the default "Erase everything" mode there is still exactly one action.
   */
  it('shows no tick boxes in "Erase everything" mode, and both modes up front (#71)', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    expect(screen.getByRole('radio', { name: /Erase everything/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Choose what to erase/i })).not.toBeChecked();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByText(/Or erase only some things/i)).not.toBeInTheDocument();
    expect(document.querySelector('details')).toBeNull();
  });

  it('disables the erase button and says why before DELETE is typed', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    expect(eraseButton()).toBeDisabled();
    expect(
      screen.getByText(/Type DELETE in the box above to enable this/i),
    ).toBeInTheDocument();
  });

  it('drops the explanation and enables the button once DELETE is typed', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    await typeConfirmation();

    await waitFor(() => expect(eraseButton()).toBeEnabled());
    expect(
      screen.queryByText(/Type DELETE in the box above to enable this/i),
    ).not.toBeInTheDocument();
  });

  it('stays disabled, with a reason, on a shop that is already empty', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(emptyPreview());
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    await typeConfirmation();

    await waitFor(() =>
      expect(screen.getByText(/nothing left to erase/i)).toBeInTheDocument(),
    );
    expect(eraseButton()).toBeDisabled();
  });
});

/**
 * "notification on successful or failed" — the outcome has to be stated, next
 * to the button, in both directions. Before this, success was a line of prose
 * at the foot of the card claiming "Sign-in accounts were not touched", which
 * had also stopped being true.
 */
describe('DataResetPanel — says whether it worked', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('announces a completed erase with what was removed', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    mockedPlatform.runResetAll.mockResolvedValue({
      deleted: { orders: 3, products: 2 },
      filesDeleted: 4,
    } as unknown as platformApi.ResetResult);

    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);
    await typeConfirmation();
    await waitFor(() => expect(eraseButton()).toBeEnabled());

    fireEvent.click(eraseButton());

    const note = await screen.findByRole('status');
    // "Erase everything" still goes to /reset/all, never the group endpoint.
    expect(mockedPlatform.runResetAll).toHaveBeenCalledWith('DELETE');
    expect(mockedPlatform.runReset).not.toHaveBeenCalled();
    expect(note).toHaveTextContent(/Erase complete/i);
    expect(note).toHaveTextContent(/5 records/);
    expect(note).toHaveTextContent(/4 files/);
    // The old copy promised sign-in accounts were untouched. They are not.
    expect(note).not.toHaveTextContent(/accounts were not touched/i);
  });

  it('announces a failure with the reason, and does not claim success', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    mockedPlatform.runResetAll.mockRejectedValue(
      Object.assign(new Error('Reset is disabled in this environment.'), {
        status: 409,
        message: 'Reset is disabled in this environment.',
      }),
    );

    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);
    await typeConfirmation();
    await waitFor(() => expect(eraseButton()).toBeEnabled());

    fireEvent.click(eraseButton());

    const note = await screen.findByRole('alert');
    expect(note).toHaveTextContent(/Erase failed/i);
    expect(note).toHaveTextContent(/disabled in this environment/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('clears the last outcome when the admin starts typing again', async () => {
    // Otherwise the previous run's banner sits over the next attempt and the
    // admin cannot tell which erase it is talking about.
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    mockedPlatform.runResetAll.mockResolvedValue({
      deleted: { orders: 1 },
      filesDeleted: 0,
    } as unknown as platformApi.ResetResult);

    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);
    await typeConfirmation();
    await waitFor(() => expect(eraseButton()).toBeEnabled());

    fireEvent.click(eraseButton());
    await screen.findByRole('status');

    fireEvent.change(screen.getByLabelText(/to confirm/i), {
      target: { value: 'D' },
    });

    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
    );
  });
});

/**
 * minirue-dashboard#71. Owner, 2026-09-15: "I don't want to delete all but
 * rather select some records only." Selective erase is back, with the gate and
 * the reason sitting directly on top of the button this time.
 *
 * The groups and `requires` below mirror minirue-backend
 * src/platform/platform-reset.constants.ts on main (Accounting epic included).
 */
function groupPreview(overrides: Partial<Record<string, number>> = {}) {
  const g = (
    key: string,
    label: string,
    rowCount: number,
    requires: string[] = [],
    fileCount = 0,
  ) => ({
    key,
    label,
    description: `${label} description`,
    rowCount: overrides[key] ?? rowCount,
    fileCount,
    requires,
  });
  return {
    groups: [
      g('analytics', 'Website analytics', 40),
      g('support', 'Support conversations', 0),
      g('sales', 'Orders, payments and refunds', 12),
      g('carts', 'Shopping carts', 3),
      g('discounts', 'Discount codes and bundles', 2, ['sales']),
      g('inventory', 'Stock and warehouses', 5),
      g('notifications', 'Notifications', 8),
      g('products', 'Products', 6, ['sales', 'carts', 'inventory', 'discounts']),
      g('catalogVocabulary', 'Categories, brands and option lists', 4, ['products']),
      g('gallery', 'Gallery images', 2, [], 2),
    ],
    neverDeleted: ['users'],
    confirmationPhrase: 'DELETE',
  } as unknown as platformApi.ResetPreview;
}

function selectiveButton() {
  return screen.getByRole('button', { name: /Erase the ticked groups/i });
}

async function openChooser() {
  await screen.findByText(/Erase shop data/i);
  fireEvent.click(screen.getByRole('radio', { name: /Choose what to erase/i }));
}

describe('DataResetPanel — choose what to erase (#71)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists every group with its server label and count; empty groups are disabled', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(groupPreview());
    render(<DataResetPanel />);
    await openChooser();

    const orders = screen.getByRole('checkbox', { name: /Orders, payments and refunds/i });
    expect(orders).toBeEnabled();
    expect(screen.getByTestId('reset-group-sales')).toHaveTextContent(/12 records/);
    expect(
      screen.getByRole('checkbox', { name: /Support conversations/i }),
    ).toBeDisabled();
    expect(screen.getAllByRole('checkbox')).toHaveLength(10);
  });

  it('says "nothing selected" under the button until a group is ticked', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(groupPreview());
    render(<DataResetPanel />);
    await openChooser();
    await typeConfirmation();

    expect(selectiveButton()).toBeDisabled();
    expect(screen.getByText(/Tick at least one group above/i)).toBeInTheDocument();
    expect(screen.queryByText(/Type DELETE in the box/i)).not.toBeInTheDocument();
  });

  it('says "type the word" under the button once something is ticked but the word is not typed', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(groupPreview());
    render(<DataResetPanel />);
    await openChooser();

    fireEvent.click(screen.getByRole('checkbox', { name: /Website analytics/i }));

    expect(selectiveButton()).toBeDisabled();
    expect(screen.queryByText(/Tick at least one group above/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Type DELETE in the box above to enable this/i),
    ).toBeInTheDocument();
  });

  it('shows a live summary and Select all / Clear', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(groupPreview());
    render(<DataResetPanel />);
    await openChooser();

    fireEvent.click(screen.getByRole('checkbox', { name: /Website analytics/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Notifications/i }));
    expect(screen.getByTestId('reset-selection-summary')).toHaveTextContent(
      /about to erase 2 groups · 48 records/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /Select all/i }));
    // Every group with something in it: 9 of 10 (support is empty).
    expect(screen.getByTestId('reset-selection-summary')).toHaveTextContent(
      /about to erase 9 groups · 82 records · 2 files/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }));
    expect(screen.queryByTestId('reset-selection-summary')).not.toBeInTheDocument();
    expect(screen.getByText(/Tick at least one group above/i)).toBeInTheDocument();
  });

  it('shows the cascade next to the row and ticks what the server would erase anyway', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(groupPreview());
    render(<DataResetPanel />);
    await openChooser();

    const products = screen.getByTestId('reset-group-products');
    expect(products).toHaveTextContent(
      /Also erases: Orders, payments and refunds, Shopping carts, Stock and warehouses, Discount codes and bundles/,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Categories, brands/i }));
    // catalogVocabulary → products → sales, carts, inventory, discounts
    for (const name of [/^Products/, /Orders, payments/, /Shopping carts/, /Stock and/, /Discount codes/]) {
      const box = screen.getByRole('checkbox', { name });
      expect(box).toBeChecked();
      expect(box).toBeDisabled();
    }
    expect(screen.getByTestId('reset-group-sales')).toHaveTextContent(/Included by/i);
  });

  it('POSTs /platform/reset with exactly the ticked groups and the typed word, then refreshes counts', async () => {
    const actual = jest.requireActual('@/lib/api/platform') as typeof platformApi;
    mockedPlatform.runReset.mockImplementation(actual.runReset);
    mockedApiFetch.mockResolvedValue({
      data: { deleted: { analytics_events: 40, notification_logs: 8 }, filesDeleted: 0 },
    });
    mockedPlatform.getResetPreview
      .mockResolvedValueOnce(groupPreview())
      .mockResolvedValueOnce(groupPreview({ analytics: 0, notifications: 0 }));

    render(<DataResetPanel />);
    await openChooser();
    fireEvent.click(screen.getByRole('checkbox', { name: /Website analytics/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Notifications/i }));
    await typeConfirmation();

    await waitFor(() => expect(selectiveButton()).toBeEnabled());
    fireEvent.click(selectiveButton());

    const note = await screen.findByRole('status');
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    const [path, init] = mockedApiFetch.mock.calls[0];
    expect(path).toBe('/platform/reset');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      groups: ['analytics', 'notifications'],
      confirmation: 'DELETE',
    });
    expect(mockedPlatform.runResetAll).not.toHaveBeenCalled();

    expect(note).toHaveTextContent(/Erase complete/i);
    expect(note).toHaveTextContent(/Website analytics/);
    expect(note).toHaveTextContent(/Notifications/);
    expect(note).toHaveTextContent(/48 records/);

    // Counts refreshed from a second preview read; the ticks are cleared.
    await waitFor(() =>
      expect(screen.getByTestId('reset-group-analytics')).toHaveTextContent(/nothing to remove/i),
    );
    expect(mockedPlatform.getResetPreview).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('checkbox', { name: /Website analytics/i })).not.toBeChecked();
  });

  it('announces a failed selective erase as an alert', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(groupPreview());
    mockedPlatform.runReset.mockRejectedValue(
      Object.assign(new Error("Type 'DELETE' exactly to confirm"), { status: 400 }),
    );
    render(<DataResetPanel />);
    await openChooser();
    fireEvent.click(screen.getByRole('checkbox', { name: /Shopping carts/i }));
    await typeConfirmation();
    fireEvent.click(selectiveButton());

    const note = await screen.findByRole('alert');
    expect(note).toHaveTextContent(/Erase failed/i);
    expect(note).toHaveTextContent(/exactly to confirm/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
