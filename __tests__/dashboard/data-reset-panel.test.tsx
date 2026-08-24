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
      { key: 'orders', label: 'Orders', description: 'All orders', rowCount: 3, fileCount: 0, requires: [] },
    ],
    neverDeleted: ['users'],
    confirmationPhrase,
  } as unknown as platformApi.ResetPreview;
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

    // Tick the one group so the confirm section shows.
    screen.getByRole('checkbox').click();

    await waitFor(() =>
      expect(
        screen.getByText(/confirmation phrase is unavailable/i),
      ).toBeInTheDocument(),
    );
    // No confirm input is offered — there is nothing to type.
    expect(screen.queryByLabelText(/to confirm/i)).not.toBeInTheDocument();
  });

  it('shows the normal confirm input when a phrase is present', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    screen.getByRole('checkbox').click();

    await waitFor(() => expect(screen.getByText('DELETE')).toBeInTheDocument());
  });
});

/**
 * Owner, 2026-08-24: "erase ticked data isnt working".
 *
 * It was working exactly as written — the button was disabled because DELETE
 * had not been typed. Two things hid that. `.dash-btn-danger` had no
 * `:disabled` rule at all (every other button variant does), so a dead button
 * rendered at full colour with cursor:pointer; and the typing box sits at the
 * top of the panel while the ticked-data button sits at the bottom of a
 * collapsed <details>, off-screen. Clicking a button that looks alive and
 * getting nothing reads as broken software.
 *
 * The panel now says why it cannot run, next to the button that cannot run.
 */
describe('DataResetPanel — why the erase button will not fire', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disables the ticked-data button and says why before DELETE is typed', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    screen.getByRole('checkbox').click();

    const button = await screen.findByRole('button', { name: /Erase the ticked data/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/Type DELETE in the box above to enable this/i),
    ).toBeInTheDocument();
  });

  it('drops the explanation and enables the button once DELETE is typed', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('DELETE'));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    screen.getByRole('checkbox').click();

    fireEvent.change(await screen.findByLabelText(/to confirm/i), {
      target: { value: 'DELETE' },
    });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Erase the ticked data/i }),
      ).toBeEnabled(),
    );
    expect(
      screen.queryByText(/Type DELETE in the box above to enable this/i),
    ).not.toBeInTheDocument();
  });
});
