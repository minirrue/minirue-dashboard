'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiCustomerEmailActivity, type CustomerEmailActivityItem } from '@/lib/api/email-operations';
import DirectEmailComposer from './DirectEmailComposer';
import { formatDateTime } from '@/lib/dates/format';

function when(value: string) {
  return formatDateTime(value, { year: true });
}

export default function CustomerEmailActivity({ customerId, customerName, email }: { customerId: string; customerName: string; email?: string | null }) {
  const [items, setItems] = useState<CustomerEmailActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiCustomerEmailActivity({ customerId, email })
      .then((rows) => { if (alive) { setItems(rows); setError(null); } })
      .catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : 'Email history could not be loaded.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [customerId, email]);

  return <section className="dash-form-section" aria-labelledby="customer-email-activity-title">
    <div className="dash-section-header" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <div><h2 className="dash-section-title" id="customer-email-activity-title">Email history</h2><p className="dash-help-text">Messages and provider outcomes linked to this customer.</p></div>
      <DirectEmailComposer recipient={email} customerId={customerId} variables={{ customerName }} />
    </div>
    {loading ? <span className="dash-skeleton" style={{ display: 'block', height: 72 }} /> : error ? <div className="dash-inline-error" role="alert"><strong>Email history unavailable.</strong> {error}</div> : items.length === 0 ? <p className="dash-help-text">No email recorded for this customer yet.</p> : <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Subject</th><th>Direction</th><th>Status</th><th>When</th><th>Detail</th></tr></thead><tbody>{items.map((item) => <tr key={item.message.id}><td><Link className="dash-link" href={`/emails?thread=${item.thread.id}`}>{item.message.subject}</Link></td><td>{item.message.direction === 'INBOUND' ? 'Received' : 'Sent'}</td><td><span className="dash-status" data-status={item.status}>{item.status.toLowerCase()}</span></td><td>{when(item.message.createdAt)}</td><td style={{ color: item.failureReason ? 'var(--mr-st-danger-fg)' : 'var(--mr-fg-4)', overflowWrap: 'anywhere' }}>{item.failureReason || '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}
