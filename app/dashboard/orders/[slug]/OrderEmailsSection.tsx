import React from 'react';
import type { OrderEmailLog, OrderEmailLogEntry } from '@/lib/api/orders';
import DirectEmailComposer from '@/components/dashboard/email/DirectEmailComposer';

/**
 * The emails the customer was sent about this order, read-only (backend#135).
 *
 * Guests have no order page on the storefront — the owner's call is that their
 * orders are followed here and they are told by email. So this is where an
 * admin answers "did the guest actually get told it shipped?": each email,
 * sent or failed, and the server's reason when it failed.
 */

const TEMPLATE_LABELS: Record<string, string> = {
  'order.confirmed': 'Order confirmed',
  'order.shipped': 'Order shipped',
  'order.delivered': 'Order delivered',
  'order.cancelled': 'Order cancelled',
  'payment.confirmed': 'Payment received',
  'payment.failed': 'Payment failed',
  'loyalty.points_earned': 'Points earned',
};

const STATUS: Record<OrderEmailLogEntry['status'], { label: string; tone: string }> = {
  SENT: { label: 'Sent', tone: 'ok' },
  FAILED: { label: 'Failed', tone: 'danger' },
  SKIPPED: { label: 'Not sent', tone: 'warn' },
  SENDING: { label: 'Sending', tone: 'pending' },
};

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function transportNote(log: OrderEmailLog): string | null {
  switch (log.transport) {
    case 'NOT_CONFIGURED':
      return 'Email is not configured on the server, so no order email is sent or recorded.';
    case 'DRY_RUN':
      return 'The server is in dry-run mode: emails are recorded here but not delivered.';
    default:
      return null;
  }
}

function recipientNote(log: OrderEmailLog): string {
  switch (log.recipient) {
    case 'GUEST':
      return "Order emails go to the guest's checkout email.";
    case 'ACCOUNT':
      return "Order emails go to the customer's account email.";
    default:
      return 'This order has no email address, so no order email can be sent.';
  }
}

export default function OrderEmailsSection({ log, orderId, orderNumber, customerName, recipientEmail }: { log: OrderEmailLog; orderId: string; orderNumber: string; customerName: string; recipientEmail?: string | null }) {
  const note = transportNote(log);
  return (
    <section className="dash-form-section" aria-labelledby="order-emails-title">
      <div className="dash-section-header">
        <h2 className="dash-section-title" id="order-emails-title">
          Customer emails
        </h2>
        <DirectEmailComposer recipient={recipientEmail} orderId={orderId} variables={{ orderNumber, customerName }} />
      </div>
      <p className="dash-help-text" style={{ margin: '0 0 8px' }}>
        {recipientNote(log)}
      </p>
      {note && (
        <p className="dash-help-text" style={{ margin: '0 0 8px', color: 'var(--mr-st-warn-fg)' }}>
          {note}
        </p>
      )}
      {log.emails.length === 0 ? (
        <p style={{ color: 'var(--mr-fg-4)', fontSize: 14, margin: 0 }}>
          No email recorded for this order yet.
        </p>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>When</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {log.emails.map((email) => {
                const status = STATUS[email.status] ?? { label: email.status, tone: 'pending' };
                return (
                  <tr key={`${email.template}-${email.createdAt}`}>
                    <td>{TEMPLATE_LABELS[email.template] ?? email.template}</td>
                    <td>
                      <span className="dash-status" data-status={status.tone}>
                        <span className="dash-status-dot" />
                        {status.label}
                      </span>
                    </td>
                    <td style={{ color: 'var(--mr-fg-3)' }}>
                      {formatWhen(email.sentAt ?? email.attemptedAt ?? email.createdAt)}
                    </td>
                    <td
                      style={{
                        color: email.status === 'FAILED' ? 'var(--mr-st-danger-fg)' : 'var(--mr-fg-4)',
                        fontSize: 12,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {email.errorText ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
