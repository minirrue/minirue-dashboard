'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  apiAdminAdjustTier,
  apiAdminDeleteCustomer,
  apiAdminGetCustomer,
  type CustomerDetail,
  type TierLevel,
} from '@/lib/api/customers';
import type { ApiError } from '@/lib/api/client';

const TIER_OPTIONS: TierLevel[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(amount: string, currency: string): string {
  return `${currency} ${parseFloat(amount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}

function displayName(customer: CustomerDetail): string {
  if (customer.displayName) return customer.displayName;
  const full = `${customer.firstName} ${customer.lastName}`.trim();
  return full || customer.customerId;
}

function Skeleton() {
  return (
    <div className="dash-form-section">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="dash-skeleton" style={{ width: i % 2 === 0 ? '60%' : '40%', marginBottom: 8 }} />
      ))}
    </div>
  );
}

export default function CustomerDetailClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<TierLevel>('BRONZE');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiAdminGetCustomer(userId);
      setCustomer(data);
      setTier(data.tier);
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdjustTier = async () => {
    if (!customer) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await apiAdminAdjustTier(userId, {
        tier,
        reason: reason.trim() || undefined,
      });
      setCustomer(updated);
      setSaveMsg('Tier updated.');
    } catch (e) {
      setSaveMsg((e as ApiError).message ?? 'Failed to update tier');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiAdminDeleteCustomer(userId);
      router.push('/customers');
    } catch (e) {
      setDeleteError((e as ApiError).message ?? 'Failed to delete customer');
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="dash-page-header">
        <div>
          <Link href="/customers" className="dash-link" style={{ fontSize: 13 }}>
            ← Customers
          </Link>
          <h1 className="dash-page-title" style={{ marginTop: 8 }}>
            {customer ? displayName(customer) : 'Customer'}
          </h1>
        </div>
        {customer && (
          <button
            type="button"
            className="dash-btn-danger"
            onClick={() => setDeleteConfirmOpen(true)}
            data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-delete-customer"
          >
            Delete account
          </button>
        )}
      </div>

      {deleteConfirmOpen && (
        <div
          className="dash-gallery-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Delete customer account"
        >
          <div
            className="dash-card"
            style={{ maxWidth: 440, width: '90%', textAlign: 'left' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="dash-section-title" style={{ marginBottom: 12 }}>
              Delete this customer's account?
            </h2>
            <p className="dash-help-text" style={{ marginBottom: 12 }}>
              This anonymizes their personal data (name, email, addresses) per GDPR — their past
              orders stay on record for accounting, but their account can no longer sign in. This
              cannot be undone.
            </p>
            {deleteError && <p className="dash-inline-error">{deleteError}</p>}
            <div className="dash-form-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="dash-btn-danger"
                disabled={deleting}
                onClick={() => void handleDelete()}
                data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-confirm-delete-customer"
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
              <button
                type="button"
                className="dash-btn-ghost"
                disabled={deleting}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
          <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={load}>
            Retry
          </button>
        </div>
      ) : customer ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <section className="dash-form-section" style={{ margin: 0 }}>
              <h2 className="dash-section-title" style={{ marginBottom: 16 }}>
                Profile
              </h2>
              <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Customer ID:</strong> {customer.customerId}
              </p>
              <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Name:</strong> {customer.firstName} {customer.lastName}
              </p>
              <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Display name:</strong> {customer.displayName ?? '—'}
              </p>
              <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Phone:</strong> {customer.phone ?? '—'}
              </p>
              <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Email verified:</strong> {customer.emailVerified ? 'Yes' : 'No'}
              </p>
              <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Lifetime spend:</strong>{' '}
                {formatMoney(customer.lifetimeSpendAmount, customer.lifetimeSpendCurrency)}
              </p>
              <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Joined:</strong> {formatDate(customer.createdAt)}
              </p>
              {customer.gdprEraseRequestedAt && (
                <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-st-danger-fg, #b91c1c)' }}>
                  <strong>GDPR erase requested:</strong> {formatDate(customer.gdprEraseRequestedAt)}
                </p>
              )}
            </section>

            <section className="dash-form-section" style={{ margin: 0 }}>
              <h2 className="dash-section-title" style={{ marginBottom: 16 }}>
                Adjust tier
              </h2>
              <div className="dash-field" style={{ marginBottom: 12 }}>
                <label className="dash-label" htmlFor="tier-select">
                  Tier
                </label>
                <select
                  id="tier-select"
                  className="dash-select"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as TierLevel)}
                >
                  {TIER_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dash-field" style={{ marginBottom: 12 }}>
                <label className="dash-label" htmlFor="tier-reason">
                  Reason (optional)
                </label>
                <input
                  id="tier-reason"
                  className="dash-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this tier changing?"
                />
              </div>
              {saveMsg && (
                <p className="dash-help-text" style={{ marginBottom: 12 }}>
                  {saveMsg}
                </p>
              )}
              <button
                className="dash-btn-primary"
                disabled={saving || tier === customer.tier}
                onClick={handleAdjustTier}
              >
                {saving ? 'Saving…' : 'Save tier'}
              </button>
            </section>
          </div>

          <section className="dash-form-section">
            <h2 className="dash-section-title" style={{ marginBottom: 16 }}>
              Addresses ({customer.addresses.length})
            </h2>
            {customer.addresses.length === 0 ? (
              <p className="dash-help-text">No addresses on file.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {customer.addresses.map((addr) => (
                  <div
                    key={addr.id}
                    style={{
                      padding: '12px 16px',
                      border: '1px solid var(--mr-dash-hair)',
                      borderRadius: 'var(--mr-radius-sm)',
                      fontSize: 14,
                      color: 'var(--mr-fg-2)',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <strong style={{ color: 'var(--mr-fg)' }}>{addr.label}</strong>
                      {addr.isDefault && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: 'var(--mr-dash-sub)',
                            color: 'var(--mr-fg-3)',
                          }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <div>
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ''}
                    </div>
                    <div>
                      {addr.city}, {addr.governorate}
                      {addr.postalCode ? ` ${addr.postalCode}` : ''}
                    </div>
                    <div>{addr.countryCode}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
