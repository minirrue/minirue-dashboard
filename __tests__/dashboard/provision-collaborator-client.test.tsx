import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * 2026-07-30 owner ask: "when we add a collaborator we set his first and
 * last name also and last name is optional please on collaborator page for
 * admin." First name is required, last name is optional — both should reach
 * apiCreateCollaborator, which now persists them onto the collaborator's own
 * customerProfiles row (CollaboratorsService.provision on the backend).
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/api/collaborators', () => ({
  apiCreateCollaborator: jest.fn(),
}));

import ProvisionCollaboratorClient from '@/app/dashboard/collaborators/new/ProvisionCollaboratorClient';
import { apiCreateCollaborator } from '@/lib/api/collaborators';

const mockCreate = apiCreateCollaborator as jest.Mock;

function fillRequiredNonNameFields() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'brand@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Brand name'), {
    target: { value: 'Helya' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'collab-1' });
});

describe('ProvisionCollaboratorClient — first/last name', () => {
  it('rejects submission with no first name', async () => {
    const { container } = render(<ProvisionCollaboratorClient />);
    fillRequiredNonNameFields();

    // fireEvent.click on the submit button would be blocked by the native
    // `required` attribute on the First name input before React's onSubmit
    // ever runs (jsdom performs HTML5 constraint validation on a real click
    // submission). Submitting the form element directly bypasses that, the
    // same way a form auto-submitted via JS (not a user click) would, and
    // exercises the JS validation this test is actually about.
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(screen.getByText(/first name is required/i)).toBeInTheDocument());
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('accepts submission with a first name and no last name', async () => {
    render(<ProvisionCollaboratorClient />);
    fillRequiredNonNameFields();
    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Sara' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.firstName).toBe('Sara');
    expect(payload.lastName).toBeUndefined();
  });

  it('passes both names through when a last name is given', async () => {
    render(<ProvisionCollaboratorClient />);
    fillRequiredNonNameFields();
    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Sara' },
    });
    fireEvent.change(screen.getByLabelText('Last name'), {
      target: { value: 'Youssef' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.firstName).toBe('Sara');
    expect(payload.lastName).toBe('Youssef');
  });
});
