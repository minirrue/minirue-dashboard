import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EmailOperationsClient from '@/app/dashboard/emails/EmailOperationsClient';

jest.mock('@/lib/api/email-operations', () => ({
  ...jest.requireActual('@/lib/api/email-operations'),
  apiEmailThreads: jest.fn().mockResolvedValue([]),
  apiEmailThread: jest.fn(),
  apiEmailEvents: jest.fn().mockResolvedValue([]),
  apiEmailCampaigns: jest.fn().mockResolvedValue([]),
  apiEmailTemplates: jest.fn().mockResolvedValue([]),
  apiEmailBranding: jest.fn().mockResolvedValue({ logoUrl: null, logoShape: 'ROUNDED' }),
}));

jest.mock('@/lib/hooks/use-clear-nav-badge', () => ({ useClearNavBadge: jest.fn() }));

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({ data: { userId: 'admin-1', email: 'admin@example.test', role: 'SUPERADMIN' } }),
}));

function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><EmailOperationsClient /></QueryClientProvider>);
}

it('moves between every email operations workspace without hiding core controls', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Email templates' })).toBeInTheDocument();
  expect(await screen.findByText('No templates yet')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Branding' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Email branding' })).toBeInTheDocument();
  expect(await screen.findByLabelText('Logo shape')).toHaveValue('ROUNDED');
});

it('renders the customer name and linked orders returned by the backend contract', async () => {
  const api = jest.requireMock('@/lib/api/email-operations') as Record<string, jest.Mock>;
  api.apiEmailThreads.mockResolvedValueOnce([{ id: 'thread-1', customerId: 'customer-1', customerName: 'Mariam Adel', participantEmail: 'mariam@example.test', subject: 'Delivery', status: 'OPEN', unread: false, lastMessageAt: '2026-09-17T10:00:00Z', createdAt: '2026-09-17T10:00:00Z', updatedAt: '2026-09-17T10:00:00Z' }]);
  api.apiEmailThread.mockResolvedValueOnce({ thread: { id: 'thread-1', customerId: 'customer-1', customerName: 'Mariam Adel', participantEmail: 'mariam@example.test', subject: 'Delivery', status: 'OPEN', unread: false, lastMessageAt: '2026-09-17T10:00:00Z', createdAt: '2026-09-17T10:00:00Z', updatedAt: '2026-09-17T10:00:00Z', orders: [{ id: 'order-1', orderNumber: 'MR-42', status: 'SHIPPED', createdAt: '2026-09-16T10:00:00Z' }] }, messages: [] });
  renderClient();
  expect(await screen.findAllByText('Mariam Adel')).not.toHaveLength(0);
  expect(await screen.findByRole('link', { name: /MR-42/i })).toHaveAttribute('href', '/orders/order-1');
});
