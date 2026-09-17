import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CollaboratorReviewClient from '@/app/dashboard/collaborators/review/CollaboratorReviewClient';
import {
  apiListPendingReviewProducts,
  apiRejectCollaboratorProduct,
} from '@/lib/api/collaborators';

jest.mock('@/lib/api/collaborators', () => ({
  apiApproveCollaboratorProduct: jest.fn(),
  apiListPendingReviewProducts: jest.fn(),
  apiRejectCollaboratorProduct: jest.fn(),
}));

const listPending = apiListPendingReviewProducts as jest.Mock;
const rejectProduct = apiRejectCollaboratorProduct as jest.Mock;

describe('collaborator rejection reason', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listPending.mockResolvedValue({
      items: [{
        id: 'product-1',
        name: 'Rose Serum',
        brandSlug: 'helia',
        brandName: 'Helia',
        priceAmount: '799.00',
        submittedAt: '2026-09-17T08:00:00.000Z',
      }],
    });
    rejectProduct.mockResolvedValue(undefined);
  });

  it('requires an explanation for Other and sends readable partner-facing text', async () => {
    const user = userEvent.setup();
    render(<CollaboratorReviewClient />);

    await screen.findByText('Rose Serum');
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.click(screen.getByRole('radio', { name: 'Other' }));
    await user.click(screen.getByRole('button', { name: 'Confirm reject' }));
    expect(await screen.findByText(/explain the rejection/i)).toBeInTheDocument();
    expect(rejectProduct).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Explain the rejection'), 'Please add ingredient photos.');
    await user.click(screen.getByRole('button', { name: 'Confirm reject' }));
    await waitFor(() => expect(rejectProduct).toHaveBeenCalledWith(
      'product-1',
      'Please add ingredient photos.',
    ));
  });
});
