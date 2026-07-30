import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
