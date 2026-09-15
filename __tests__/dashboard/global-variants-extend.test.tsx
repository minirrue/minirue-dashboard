import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * minirue-dashboard#73: adding "ML" with Perfumes ticked, when ML already exists
 * for Haircare, used to POST and die on "Global variant 'ML' already exists".
 * The page now spots the clash (case-insensitive, like the backend) and offers
 * one click that PATCHes the existing field's categories instead.
 */

jest.mock('@/components/dashboard/CatalogSubnav', () => ({
  __esModule: true,
  default: () => null,
}));

const listAdminAttributes = jest.fn();
const listCategories = jest.fn();
const createAttribute = jest.fn();
const updateAttribute = jest.fn();

jest.mock('@/lib/catalog/api', () => ({
  listAdminAttributes: (...a: unknown[]) => listAdminAttributes(...a),
  listCategories: (...a: unknown[]) => listCategories(...a),
  createAttribute: (...a: unknown[]) => createAttribute(...a),
  updateAttribute: (...a: unknown[]) => updateAttribute(...a),
  deleteAttribute: jest.fn(),
}));

import GlobalVariantsPage from '@/app/dashboard/products/global-variants/page';

const HAIR = '11111111-1111-4111-8111-111111111111';
const PERF = '22222222-2222-4222-8222-222222222222';

const ml = { id: 'attr-ml', name: 'ML', isActive: true, sortOrder: 0, categoryIds: [HAIR] };

beforeEach(() => {
  jest.clearAllMocks();
  listAdminAttributes.mockResolvedValue([ml]);
  listCategories.mockResolvedValue({
    items: [
      { id: HAIR, name: 'Haircare' },
      { id: PERF, name: 'Perfumes' },
    ],
  });
});

it('offers to add Perfumes to the existing ML instead of creating a duplicate', async () => {
  updateAttribute.mockResolvedValue({ ...ml, categoryIds: [HAIR, PERF] });
  const user = userEvent.setup();
  render(<GlobalVariantsPage />);
  await screen.findByRole('heading', { name: 'ML' });

  await user.type(screen.getByLabelText(/Field name/), 'ml');
  const perfumeBoxes = screen.getAllByRole('checkbox', { name: 'Perfumes' });
  await user.click(perfumeBoxes[0]);

  expect(screen.getByRole('status')).toHaveTextContent('ML already exists and applies to Haircare.');
  expect(screen.queryByRole('button', { name: 'Add field' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Add Perfumes to ML' }));

  expect(updateAttribute).toHaveBeenCalledWith('attr-ml', { categoryIds: [HAIR, PERF] });
  expect(createAttribute).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByText('Applies to: Haircare, Perfumes')).toBeInTheDocument());
});

it('says nothing to add when the ticked categories are already covered', async () => {
  const user = userEvent.setup();
  render(<GlobalVariantsPage />);
  await screen.findByRole('heading', { name: 'ML' });

  await user.type(screen.getByLabelText(/Field name/), 'ML');
  await user.click(screen.getAllByRole('checkbox', { name: 'Haircare' })[0]);

  expect(screen.getByRole('status')).toHaveTextContent('Nothing to add.');
  expect(screen.queryByRole('button', { name: /to ML|Restore/ })).not.toBeInTheDocument();
});

it('still creates a genuinely new field', async () => {
  createAttribute.mockResolvedValue({ id: 'attr-c', name: 'Concentration', isActive: true, sortOrder: 0, categoryIds: [PERF] });
  const user = userEvent.setup();
  render(<GlobalVariantsPage />);
  await screen.findByRole('heading', { name: 'ML' });

  await user.type(screen.getByLabelText(/Field name/), 'Concentration');
  await user.click(screen.getAllByRole('checkbox', { name: 'Perfumes' })[0]);
  await user.click(screen.getByRole('button', { name: 'Add field' }));

  expect(createAttribute).toHaveBeenCalledWith({ name: 'Concentration', categoryIds: [PERF] });
});
