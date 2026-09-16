import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EmailOperationsClient from '@/app/dashboard/emails/EmailOperationsClient';

jest.mock('@/lib/api/email-operations', () => ({
  ...jest.requireActual('@/lib/api/email-operations'),
  apiEmailThreads: jest.fn().mockResolvedValue([]),
  apiEmailEvents: jest.fn().mockResolvedValue([]),
  apiEmailCampaigns: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: { userId: 'admin-1', email: 'admin@example.test', role: 'SUPERADMIN' } }),
}));

function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><EmailOperationsClient /></QueryClientProvider>);
}

it('moves between inbox, event log and campaigns without hiding core controls', async () => {
  renderClient();
  expect(screen.getByRole('heading', { name: 'Customer email' })).toBeInTheDocument();
  expect(await screen.findByText('No matching email')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Event log' }));
  expect(screen.getByRole('heading', { name: 'Email events' })).toBeInTheDocument();
  expect(await screen.findByText('No matching events')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Campaigns' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save and preview' })).toBeDisabled();
  expect(await screen.findByText('No campaigns yet')).toBeInTheDocument();
});
