import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as platformApi from '@/lib/api/platform';
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

const mockedPlatform = platformApi as jest.Mocked<typeof platformApi>;

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

  it('offers no per-group tick boxes at all', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(
      screen.queryByRole('button', { name: /Erase the ticked data/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Or erase only some things/i)).not.toBeInTheDocument();
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
