import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DirectEmailComposer from '@/components/dashboard/email/DirectEmailComposer';
import { apiSendDirectEmail } from '@/lib/api/email-operations';

jest.mock('@/lib/api/email-operations', () => ({
  apiSendDirectEmail: jest.fn(),
}));

const send = apiSendDirectEmail as jest.Mock;

it('previews resolved variables and sends the exact customer/order context', async () => {
  send.mockResolvedValue({ id: 'message-1', status: 'SENT' });
  const user = userEvent.setup();
  render(<DirectEmailComposer recipient="mariam@example.test" customerId="customer-1" orderId="order-1" variables={{ customerName: 'Mariam', orderNumber: 'MR-42' }} />);

  await user.click(screen.getByRole('button', { name: 'Send email' }));
  await user.selectOptions(screen.getByLabelText('Ready template'), 'order_follow_up');
  expect(screen.getByText(/Hello Mariam/)).toBeInTheDocument();
  expect(screen.getAllByText(/MR-42/)).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: 'Send now' }));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({
    to: 'mariam@example.test', customerId: 'customer-1', orderId: 'order-1',
    variables: { customerName: 'Mariam', orderNumber: 'MR-42' },
  }), expect.any(String));
});

it('sends a custom message to an address entered in the Email workspace', async () => {
  send.mockResolvedValue({ id: 'message-2', status: 'SENT' });
  const user = userEvent.setup();
  render(<DirectEmailComposer editableRecipient embedded variables={{}} />);

  expect(screen.queryByRole('button', { name: 'Compose email' })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('To'), 'customer@example.com');
  await user.type(screen.getByLabelText('Subject'), 'A personal update');
  await user.type(screen.getByLabelText('Message'), 'Hello from MiniRueShop');
  await user.click(screen.getByRole('button', { name: 'Send now' }));

  expect(send).toHaveBeenCalledWith(expect.objectContaining({
    to: 'customer@example.com',
    subject: 'A personal update',
    text: 'Hello from MiniRueShop',
  }), expect.any(String));
  expect(await screen.findByText('Email sent to customer@example.com.')).toBeInTheDocument();
});

it('does not pretend to send when the endpoint rejects the request', async () => {
  send.mockRejectedValue(new Error('Endpoint unavailable'));
  const user = userEvent.setup();
  render(<DirectEmailComposer recipient="mariam@example.test" variables={{ customerName: 'Mariam' }} />);
  await user.click(screen.getByRole('button', { name: 'Send email' }));
  await user.type(screen.getByLabelText('Subject'), 'Hello');
  await user.type(screen.getByLabelText('Message'), 'Checking in');
  await user.click(screen.getByRole('button', { name: 'Send now' }));
  expect(await screen.findByText('Endpoint unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Email sent.')).not.toBeInTheDocument();
});
