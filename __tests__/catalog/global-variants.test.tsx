import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GlobalVariantsPage from '@/app/dashboard/products/global-variants/page';
import * as api from '@/lib/catalog/api';

// Global variants admin screen (specs/2026-07-22-global-variants).
jest.mock('@/lib/catalog/api');

const mockedApi = api as jest.Mocked<typeof api>;

const ACTIVE = {
  id: 'vt-1',
  name: 'EDP',
  sortOrder: 0,
  isActive: true,
};
const RETIRED = {
  id: 'vt-2',
  name: 'spray',
  sortOrder: 100,
  isActive: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.listAdminVariantTypes.mockResolvedValue([ACTIVE, RETIRED]);
});

describe('GlobalVariantsPage', () => {
  it('lists both active and retired types', async () => {
    render(<GlobalVariantsPage />);

    expect(await screen.findByText('EDP')).toBeInTheDocument();
    expect(screen.getByText('spray')).toBeInTheDocument();
  });

  it('marks a retired type and offers to reactivate it', async () => {
    render(<GlobalVariantsPage />);

    expect(await screen.findByText(/retired/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reactivate/i }),
    ).toBeInTheDocument();
  });

  it('offers Retire — not Delete — for an active type', async () => {
    render(<GlobalVariantsPage />);

    await screen.findByText('EDP');
    expect(screen.getByRole('button', { name: /^retire$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it('adds a new type and shows it in the list', async () => {
    mockedApi.createVariantType.mockResolvedValue({
      id: 'vt-3',
      name: 'Body Mist',
      sortOrder: 0,
      isActive: true,
    });
    render(<GlobalVariantsPage />);
    await screen.findByText('EDP');

    fireEvent.change(screen.getByPlaceholderText(/new variant type/i), {
      target: { value: 'Body Mist' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(await screen.findByText('Body Mist')).toBeInTheDocument();
    expect(mockedApi.createVariantType).toHaveBeenCalledWith('Body Mist');
  });

  it('surfaces the duplicate-name error from the API', async () => {
    mockedApi.createVariantType.mockRejectedValue({
      status: 400,
      message: "Variant type 'EDP' already exists",
    });
    render(<GlobalVariantsPage />);
    await screen.findByText('EDP');

    fireEvent.change(screen.getByPlaceholderText(/new variant type/i), {
      target: { value: 'EDP' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(
      await screen.findByText(/already exists/i),
    ).toBeInTheDocument();
  });

  it('retiring calls the soft-delete endpoint, never a hard delete', async () => {
    mockedApi.deactivateVariantType.mockResolvedValue(undefined);
    render(<GlobalVariantsPage />);
    await screen.findByText('EDP');

    fireEvent.click(screen.getByRole('button', { name: /^retire$/i }));

    await waitFor(() =>
      expect(mockedApi.deactivateVariantType).toHaveBeenCalledWith('vt-1'),
    );
  });

  it('shows an empty-state pointing the admin at the add form', async () => {
    mockedApi.listAdminVariantTypes.mockResolvedValue([]);
    render(<GlobalVariantsPage />);

    expect(
      await screen.findByText(/no variant types yet/i),
    ).toBeInTheDocument();
  });
});
