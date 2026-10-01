import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssistedOrderClient from '@/app/dashboard/orders/new/AssistedOrderClient';
import { completeAssistedReview, createAssistedReview, getAssistedCatalog, getAssistedReview, getCustomerNeeds, type AssistedReview } from '@/lib/api/assisted-sales';
import { assistedReviewOrigin } from '@/lib/storefront/origin';

let savedReview: string | null = null;
const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }), useSearchParams: () => ({ get: () => savedReview }) }));
jest.mock('@/lib/hooks/use-auth', () => ({ useUser: () => ({ data: { role: 'STAFF' } }) }));
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,x') }));
jest.mock('@/components/dashboard/DashboardActionBar', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer> }));
jest.mock('@/components/dashboard/AnimatedControls', () => ({ MenuSelect: ({ label }: { label: string }) => <span>{label}</span> }));
jest.mock('@/lib/api/assisted-sales', () => ({ createAssistedReview: jest.fn(), getAssistedReview: jest.fn(), completeAssistedReview: jest.fn(), cancelAssistedReview: jest.fn(), getAssistedCatalog: jest.fn(), getCustomerNeeds: jest.fn() }));

const review: AssistedReview = {
  id: 'review-1', token: 'private-token', reviewPath: '/booth/review/private-token', status: 'AWAITING_PAYMENT', salesMode: 'GROUND', currency: 'EGP',
  customer: { id: 'cx', firstName: 'Nour', lastName: null, phone: '+201012431350', email: null, registrationStatus: 'NOT_SIGNED_UP' },
  items: [{ id: 'bundle-1', kind: 'BUNDLE', bundleId: 'bundle-1', variantId: null, name: 'Hair set', sku: 'SET', sizeMl: null, quantity: 1, unitPriceMinor: 149900, lineTotalMinor: 149900, imageUrl: null }],
  subtotalMinor: 149900, totalMinor: 149900, shippingMinor: 0,
  loyalty: { expectedPoints: 2998, egpValueMinor: null, pointsPerEgp: 2, egpPerPoint: null }, expiresAt: '2030-01-01', completedAt: null, orderNumber: null,
};

beforeEach(() => {
  jest.clearAllMocks(); savedReview = null;
  jest.mocked(getCustomerNeeds).mockResolvedValue({ data: [] });
  jest.mocked(getAssistedCatalog).mockResolvedValue({ data: [{ id: 'bundle-1', kind: 'BUNDLE', bundleId: 'bundle-1', variantId: null, productId: null, name: 'Hair set', sku: 'SET', sizeMl: null, onlinePriceMinor: 140000, groundPriceMinor: 149900, availableStock: 3, imageUrl: null }], page: 1, hasMore: false });
  jest.mocked(getAssistedReview).mockResolvedValue(review);
  jest.mocked(createAssistedReview).mockResolvedValue(review);
});

test('customer review links stay in the matching preview or production environment', () => {
  expect(assistedReviewOrigin('pre-dashboard.minirueshop.com')).toBe('https://pre.minirueshop.com');
  expect(assistedReviewOrigin('dashboard.minirueshop.com')).toBe('https://minirueshop.com');
  expect(assistedReviewOrigin('localhost')).toBe('https://minirueshop.com');
});

test('creates a bundle review with normalized mobile and never completes a purchase from the form', async () => {
  render(<AssistedOrderClient />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add Hair set' }));
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nour' } });
  fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '01012431350' } });
  fireEvent.submit(document.getElementById('assisted-entry')!);
  await waitFor(() => expect(createAssistedReview).toHaveBeenCalledWith(expect.objectContaining({ customer: expect.objectContaining({ phone: '+201012431350' }), items: [{ bundleId: 'bundle-1', qty: 1 }] })));
  expect(completeAssistedReview).not.toHaveBeenCalled();
  expect(await screen.findByText('Not signed up')).toBeInTheDocument();
});

test('entry keeps optional indicators alongside their labels and does not duplicate the exit in its transaction footer', async () => {
  render(<AssistedOrderClient />);
  await screen.findByRole('button', { name: 'Add Hair set' });
  const last = screen.getByLabelText(/Last name/).closest('label')!;
  const email = screen.getByLabelText(/Email/).closest('label')!;
  expect(last.querySelector('.ao-label-line')).toHaveTextContent('Last name Optional');
  expect(email.querySelector('.ao-label-line')).toHaveTextContent('Email Optional');
  expect(screen.getAllByRole('link', { name: 'Orders' })).toHaveLength(1);
  expect(document.querySelector('footer')?.querySelector('a[href="/orders"]')).toBeNull();
});

test('missing Ground price is unavailable rather than free and cannot be added', async () => {
  jest.mocked(getAssistedCatalog).mockResolvedValue({ data: [{ id: 'unpriced', kind: 'VARIANT', variantId: 'unpriced', bundleId: null, productId: 'p1', name: 'Unpriced item', sku: null, sizeMl: null, onlinePriceMinor: 50000, groundPriceMinor: null, availableStock: 2, imageUrl: null }], page: 1, hasMore: false });
  render(<AssistedOrderClient />);
  expect(await screen.findByText('Ground price unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Unpriced item' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Online · delivery' }));
  expect(screen.getByRole('button', { name: 'Add Unpriced item' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Add Unpriced item' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ground · collect in person' }));
  expect(screen.getByRole('button', { name: 'Review with customer' })).toBeDisabled();
  expect(screen.getAllByText('Price unavailable').length).toBeGreaterThan(0);
  expect(createAssistedReview).not.toHaveBeenCalled();
});

test('ambiguous completion checks status and never issues a duplicate completion', async () => {
  savedReview = 'review-1';
  jest.mocked(completeAssistedReview).mockRejectedValue(new Error('lost response'));
  jest.mocked(getAssistedReview).mockResolvedValueOnce(review).mockResolvedValueOnce({ ...review, status: 'COMPLETED', orderId: 'order-1', orderNumber: 'MR-123' });
  render(<AssistedOrderClient />);
  fireEvent.click(await screen.findByLabelText('Payment received and verified'));
  fireEvent.click(screen.getByLabelText('Products handed to the customer'));
  fireEvent.click(screen.getByRole('button', { name: /Customer bought/ }));
  expect(await screen.findByText('Purchase recorded')).toBeInTheDocument();
  expect(completeAssistedReview).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('button', { name: 'New order' })).toHaveLength(2);
});

test('lost quote response retries the identical idempotency key and frozen request', async () => {
  jest.mocked(createAssistedReview).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(review);
  render(<AssistedOrderClient />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add Hair set' }));
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nour' } });
  fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '1012431350' } });
  fireEvent.submit(document.getElementById('assisted-entry')!);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry same review' }));
  await waitFor(() => expect(createAssistedReview).toHaveBeenCalledTimes(2));
  expect(jest.mocked(createAssistedReview).mock.calls[0][0]).toEqual(jest.mocked(createAssistedReview).mock.calls[1][0]);
  expect(await screen.findByText('Review and confirm')).toBeInTheDocument();
});

test('lost completion and unavailable status offers status check, not another purchase', async () => {
  savedReview = 'review-1';
  jest.mocked(completeAssistedReview).mockRejectedValue(new Error('lost response'));
  jest.mocked(getAssistedReview).mockResolvedValueOnce(review).mockRejectedValue(new Error('offline'));
  render(<AssistedOrderClient />);
  fireEvent.click(await screen.findByLabelText('Payment received and verified'));
  fireEvent.click(screen.getByLabelText('Products handed to the customer'));
  fireEvent.click(screen.getByRole('button', { name: /Customer bought/ }));
  expect(await screen.findByRole('button', { name: 'Check purchase status' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Customer bought/ })).not.toBeInTheDocument();
});
