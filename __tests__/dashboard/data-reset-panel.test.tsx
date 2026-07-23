import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import * as platformApi from '@/lib/api/platform';
import DataResetPanel from '@/components/dashboard/DataResetPanel';

/**
 * A brand-new shop has no store name yet, so the reset preview comes back with
 * confirmationPhrase empty or missing. The panel used to call .trim() on it and
 * crash the ENTIRE Settings page with "Cannot read properties of undefined
 * (reading 'trim')". It must render instead, and block the wipe with a reason.
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

  it('blocks the wipe and explains why when there is no shop name', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith(''));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    // Tick the one group so the confirm section shows.
    screen.getByRole('checkbox').click();

    await waitFor(() =>
      expect(screen.getByText(/Set your shop name/i)).toBeInTheDocument(),
    );
    // No confirm input is offered — there is nothing to type.
    expect(screen.queryByLabelText(/to confirm/i)).not.toBeInTheDocument();
  });

  it('shows the normal confirm input when a phrase is present', async () => {
    mockedPlatform.getResetPreview.mockResolvedValue(previewWith('MiniRue'));
    render(<DataResetPanel />);
    await screen.findByText(/Erase shop data/i);

    screen.getByRole('checkbox').click();

    await waitFor(() => expect(screen.getByText('MiniRue')).toBeInTheDocument());
  });
});
