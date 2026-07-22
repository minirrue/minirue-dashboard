'use client';

import React, {useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  apiAdminAdjustTier,
  apiAdminBlockCustomer,
  apiAdminCreateAddress,
  apiAdminDeleteAddress,
  apiAdminDeleteCustomer,
  apiAdminGetCustomer,
  apiAdminGetCustomerOrders,
  apiAdminSetDefaultAddress,
  apiAdminUnblockCustomer,
  apiAdminUpdateAddress,
  apiAdminUpdateCustomer,
  type CustomerAddress,
  type CustomerAddressInput,
  type CustomerDetail,
  type CustomerUserStatus,
  type TierLevel,
} from '@/lib/api/customers';
import type { Order } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

const TIER_OPTIONS: TierLevel[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
const ADDRESS_LABELS: CustomerAddressInput['label'][] = ['HOME', 'WORK', 'OTHER'];

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

interface AddressFormState {
  label: CustomerAddressInput['label'];
  line1: string;
  line2: string;
  city: string;
  governorate: string;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
}

const EMPTY_ADDR: AddressFormState = {
  label: 'HOME',
  line1: '',
  line2: '',
  city: '',
  governorate: '',
  postalCode: '',
  countryCode: 'EG',
  isDefault: false,
};

function addrToForm(a: CustomerAddress): AddressFormState {
  return {
    label: a.label,
    line1: a.line1,
    line2: a.line2 ?? '',
    city: a.city,
    governorate: a.governorate,
    postalCode: a.postalCode ?? '',
    countryCode: a.countryCode,
    isDefault: a.isDefault,
  };
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

  // Account status (block / unblock)
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Editable details
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailForm, setDetailForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    displayName: '',
    phone: '',
    avatarUrl: '',
    emailVerified: false,
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);

  // Order history
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Address editing
  const [addrForm, setAddrForm] = useState<{
    mode: 'add' | 'edit';
    id?: string;
    data: AddressFormState;
  } | null>(null);
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrMsg, setAddrMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiAdminGetCustomer(userId);
      setCustomer(data);
      setTier(data.tier);
      setDetailForm({
        email: data.email ?? '',
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName ?? '',
        phone: data.phone ?? '',
        avatarUrl: data.avatarUrl ?? '',
        emailVerified: data.emailVerified,
      });
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await apiAdminGetCustomerOrders(userId, { limit: 10 });
      setOrders(res.data ?? []);
    } catch (e) {
      setOrdersError((e as ApiError).message ?? 'Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, [userId]);

  useMountedEffect(() => {
    load();
  }, [load]);

  useMountedEffect(() => {
    if (customer) {
      void loadOrders();
    }
  }, [customer, loadOrders]);

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

  const handleBlockToggle = async () => {
    if (!customer) return;
    setStatusBusy(true);
    setStatusMsg(null);
    try {
      const updated =
        customer.status === 'SUSPENDED'
          ? await apiAdminUnblockCustomer(userId)
          : await apiAdminBlockCustomer(userId);
      setCustomer(updated);
      setStatusMsg(
        updated.status === 'SUSPENDED'
          ? 'Customer blocked. They can no longer sign in.'
          : 'Customer unblocked.',
      );
    } catch (e) {
      setStatusMsg((e as ApiError).message ?? 'Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!customer) return;
    setSavingDetails(true);
    setDetailsMsg(null);
    try {
      const updated = await apiAdminUpdateCustomer(userId, {
        email: detailForm.email.trim() || undefined,
        firstName: detailForm.firstName.trim() || undefined,
        lastName: detailForm.lastName.trim() || undefined,
        displayName: detailForm.displayName.trim() || null,
        phone: detailForm.phone.trim() || null,
        avatarUrl: detailForm.avatarUrl.trim() || null,
        emailVerified: detailForm.emailVerified,
      });
      setCustomer(updated);
      setDetailForm({
        email: updated.email ?? '',
        firstName: updated.firstName,
        lastName: updated.lastName,
        displayName: updated.displayName ?? '',
        phone: updated.phone ?? '',
        avatarUrl: updated.avatarUrl ?? '',
        emailVerified: updated.emailVerified,
      });
      setEditingDetails(false);
      setDetailsMsg('Details updated.');
    } catch (e) {
      setDetailsMsg((e as ApiError).message ?? 'Failed to update details');
    } finally {
      setSavingDetails(false);
    }
  };

  const openAddAddress = () => setAddrForm({ mode: 'add', data: EMPTY_ADDR });
  const openEditAddress = (a: CustomerAddress) =>
    setAddrForm({ mode: 'edit', id: a.id, data: addrToForm(a) });
  const closeAddrForm = () => setAddrForm(null);

  const handleSaveAddr = async () => {
    if (!addrForm || !customer) return;
    setSavingAddr(true);
    setAddrMsg(null);
    const input: CustomerAddressInput = {
      label: addrForm.data.label,
      line1: addrForm.data.line1,
      line2: addrForm.data.line2 || null,
      city: addrForm.data.city,
      governorate: addrForm.data.governorate,
      postalCode: addrForm.data.postalCode || null,
      countryCode: addrForm.data.countryCode || 'EG',
      isDefault: addrForm.data.isDefault,
    };
    try {
      if (addrForm.mode === 'add') {
        await apiAdminCreateAddress(userId, input);
      } else if (addrForm.id) {
        await apiAdminUpdateAddress(userId, addrForm.id, input);
      }
      const updated = await apiAdminGetCustomer(userId);
      setCustomer(updated);
      closeAddrForm();
      setAddrMsg('Address saved.');
    } catch (e) {
      setAddrMsg((e as ApiError).message ?? 'Failed to save address');
    } finally {
      setSavingAddr(false);
    }
  };

  const handleDeleteAddr = async (addressId: string) => {
    if (!customer) return;
    setSavingAddr(true);
    setAddrMsg(null);
    try {
      await apiAdminDeleteAddress(userId, addressId);
      const updated = await apiAdminGetCustomer(userId);
      setCustomer(updated);
      setAddrMsg('Address deleted.');
    } catch (e) {
      setAddrMsg((e as ApiError).message ?? 'Failed to delete address');
    } finally {
      setSavingAddr(false);
    }
  };

  const handleSetDefaultAddr = async (addressId: string) => {
    if (!customer) return;
    setSavingAddr(true);
    setAddrMsg(null);
    try {
      await apiAdminSetDefaultAddress(userId, addressId);
      const updated = await apiAdminGetCustomer(userId);
      setCustomer(updated);
    } catch (e) {
      setAddrMsg((e as ApiError).message ?? 'Failed to set default');
    } finally {
      setSavingAddr(false);
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

  const isSuspended = customer?.status === 'SUSPENDED';

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
          {customer && (
            <span
              style={{
                display: 'inline-block',
                marginTop: 8,
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 999,
                background: isSuspended ? 'var(--mr-st-danger-bg, #fee2e2)' : 'var(--mr-dash-sub)',
                color: isSuspended ? 'var(--mr-st-danger-fg, #b91c1c)' : 'var(--mr-fg-3)',
              }}
            >
              {customer.status === 'SUSPENDED' ? 'Blocked' : 'Active'}
            </span>
          )}
        </div>
        {customer && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className={isSuspended ? 'dash-btn-secondary' : 'dash-btn-danger'}
              disabled={statusBusy}
              onClick={() => void handleBlockToggle()}
              data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-block-customer"
            >
              {statusBusy ? 'Working…' : isSuspended ? 'Unblock' : 'Block customer'}
            </button>
            <button
              type="button"
              className="dash-btn-danger"
              onClick={() => setDeleteConfirmOpen(true)}
              data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-delete-customer"
            >
              Delete account
            </button>
          </div>
        )}
      </div>

      {statusMsg && (
        <p
          className="dash-help-text"
          style={{ marginBottom: 12 }}
          data-trace-id="PG-DASHBOARD-ACCT-002::EL-TXT-status-msg"
        >
          {statusMsg}
        </p>
      )}

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
              Delete this customer&apos;s account?
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
                <strong>Email:</strong> {customer.email ?? '—'}
              </p>
              <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Phone:</strong> {customer.phone ?? '—'}
              </p>
              <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Email verified:</strong> {customer.emailVerified ? 'Yes' : 'No'}
              </p>
              <p style={{ margin: '6px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Status:</strong> {customer.status === 'SUSPENDED' ? 'Blocked' : 'Active'}
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

          <section className="dash-form-section" style={{ marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h2 className="dash-section-title" style={{ margin: 0 }}>
                Edit details
              </h2>
              {!editingDetails && (
                <button
                  type="button"
                  className="dash-btn-secondary"
                  onClick={() => setEditingDetails(true)}
                  data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-edit-details"
                >
                  Edit
                </button>
              )}
            </div>
            {editingDetails ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="dash-field">
                  <label className="dash-label" htmlFor="edit-email">
                    Email
                  </label>
                  <input
                    id="edit-email"
                    className="dash-input"
                    value={detailForm.email}
                    onChange={(e) => setDetailForm({ ...detailForm, email: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="dash-field">
                    <label className="dash-label" htmlFor="edit-first">
                      First name
                    </label>
                    <input
                      id="edit-first"
                      className="dash-input"
                      value={detailForm.firstName}
                      onChange={(e) => setDetailForm({ ...detailForm, firstName: e.target.value })}
                    />
                  </div>
                  <div className="dash-field">
                    <label className="dash-label" htmlFor="edit-last">
                      Last name
                    </label>
                    <input
                      id="edit-last"
                      className="dash-input"
                      value={detailForm.lastName}
                      onChange={(e) => setDetailForm({ ...detailForm, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor="edit-display">
                    Display name
                  </label>
                  <input
                    id="edit-display"
                    className="dash-input"
                    value={detailForm.displayName}
                    onChange={(e) => setDetailForm({ ...detailForm, displayName: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="dash-field">
                    <label className="dash-label" htmlFor="edit-phone">
                      Phone
                    </label>
                    <input
                      id="edit-phone"
                      className="dash-input"
                      value={detailForm.phone}
                      onChange={(e) => setDetailForm({ ...detailForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="dash-field">
                    <label className="dash-label" htmlFor="edit-avatar">
                      Avatar URL
                    </label>
                    <input
                      id="edit-avatar"
                      className="dash-input"
                      value={detailForm.avatarUrl}
                      onChange={(e) => setDetailForm({ ...detailForm, avatarUrl: e.target.value })}
                    />
                  </div>
                </div>
                <label
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    fontSize: 14,
                    color: 'var(--mr-fg-2)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={detailForm.emailVerified}
                    onChange={(e) => setDetailForm({ ...detailForm, emailVerified: e.target.checked })}
                  />
                  Email verified
                </label>
                {detailsMsg && (
                  <p className="dash-help-text" style={{ margin: 0 }}>
                    {detailsMsg}
                  </p>
                )}
                <div className="dash-form-actions">
                  <button
                    type="button"
                    className="dash-btn-primary"
                    disabled={savingDetails}
                    onClick={() => void handleSaveDetails()}
                    data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-save-details"
                  >
                    {savingDetails ? 'Saving…' : 'Save details'}
                  </button>
                  <button
                    type="button"
                    className="dash-btn-ghost"
                    disabled={savingDetails}
                    onClick={() => setEditingDetails(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="dash-help-text">
                Use “Edit” to change email, names, phone, avatar, or verification.
              </p>
            )}
          </section>

          <section className="dash-form-section" style={{ marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h2 className="dash-section-title" style={{ margin: 0 }}>
                Order history ({orders.length})
              </h2>
            </div>
            {ordersLoading ? (
              <p className="dash-help-text">Loading orders…</p>
            ) : ordersError ? (
              <p className="dash-inline-error">{ordersError}</p>
            ) : orders.length === 0 ? (
              <p className="dash-help-text">No orders placed yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orders.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid var(--mr-dash-hair)',
                      borderRadius: 'var(--mr-radius-sm)',
                      fontSize: 14,
                      color: 'var(--mr-fg-2)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--mr-fg)' }}>#{o.orderNumber}</strong>
                      <div style={{ fontSize: 12, marginTop: 2 }}>
                        {o.status} · {formatDate(o.createdAt)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--mr-fg)' }}>
                      {formatMoney(o.totalAmount, o.totalCurrency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dash-form-section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h2 className="dash-section-title" style={{ margin: 0 }}>
                Addresses ({customer.addresses.length})
              </h2>
              {!addrForm && (
                <button
                  type="button"
                  className="dash-btn-secondary"
                  onClick={openAddAddress}
                  data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-add-address"
                >
                  Add address
                </button>
              )}
            </div>
            {addrMsg && (
              <p className="dash-help-text" style={{ marginBottom: 12 }}>
                {addrMsg}
              </p>
            )}
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
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        {!addr.isDefault && (
                          <button
                            type="button"
                            className="dash-btn-ghost"
                            disabled={savingAddr}
                            onClick={() => void handleSetDefaultAddr(addr.id)}
                            data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-set-default-address"
                          >
                            Set default
                          </button>
                        )}
                        <button
                          type="button"
                          className="dash-btn-ghost"
                          disabled={savingAddr}
                          onClick={() => openEditAddress(addr)}
                          data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-edit-address"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="dash-btn-ghost"
                          disabled={savingAddr}
                          onClick={() => void handleDeleteAddr(addr.id)}
                          data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-delete-address"
                        >
                          Delete
                        </button>
                      </div>
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

            {addrForm && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  border: '1px solid var(--mr-dash-hair)',
                  borderRadius: 'var(--mr-radius-sm)',
                }}
              >
                <h3 className="dash-section-title" style={{ marginTop: 0, marginBottom: 12 }}>
                  {addrForm.mode === 'add' ? 'Add address' : 'Edit address'}
                </h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="dash-field">
                      <label className="dash-label">Label</label>
                      <select
                        className="dash-select"
                        value={addrForm.data.label}
                        onChange={(e) =>
                          setAddrForm({
                            ...addrForm,
                            data: {
                              ...addrForm.data,
                              label: e.target.value as AddressFormState['label'],
                            },
                          })
                        }
                      >
                        {ADDRESS_LABELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="dash-field">
                      <label className="dash-label">Country code</label>
                      <input
                        className="dash-input"
                        value={addrForm.data.countryCode}
                        maxLength={2}
                        onChange={(e) =>
                          setAddrForm({
                            ...addrForm,
                            data: { ...addrForm.data, countryCode: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="dash-field">
                    <label className="dash-label">Line 1</label>
                    <input
                      className="dash-input"
                      value={addrForm.data.line1}
                      onChange={(e) =>
                        setAddrForm({
                          ...addrForm,
                          data: { ...addrForm.data, line1: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="dash-field">
                    <label className="dash-label">Line 2</label>
                    <input
                      className="dash-input"
                      value={addrForm.data.line2}
                      onChange={(e) =>
                        setAddrForm({
                          ...addrForm,
                          data: { ...addrForm.data, line2: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="dash-field">
                      <label className="dash-label">City</label>
                      <input
                        className="dash-input"
                        value={addrForm.data.city}
                        onChange={(e) =>
                          setAddrForm({
                            ...addrForm,
                            data: { ...addrForm.data, city: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="dash-field">
                      <label className="dash-label">Governorate</label>
                      <input
                        className="dash-input"
                        value={addrForm.data.governorate}
                        onChange={(e) =>
                          setAddrForm({
                            ...addrForm,
                            data: { ...addrForm.data, governorate: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="dash-field">
                      <label className="dash-label">Postal code</label>
                      <input
                        className="dash-input"
                        value={addrForm.data.postalCode}
                        onChange={(e) =>
                          setAddrForm({
                            ...addrForm,
                            data: { ...addrForm.data, postalCode: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      fontSize: 14,
                      color: 'var(--mr-fg-2)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={addrForm.data.isDefault}
                      onChange={(e) =>
                        setAddrForm({
                          ...addrForm,
                          data: { ...addrForm.data, isDefault: e.target.checked },
                        })
                      }
                    />
                    Set as default address
                  </label>
                  <div className="dash-form-actions">
                    <button
                      type="button"
                      className="dash-btn-primary"
                      disabled={savingAddr}
                      onClick={() => void handleSaveAddr()}
                      data-trace-id="PG-DASHBOARD-ACCT-002::EL-BTN-save-address"
                    >
                      {savingAddr ? 'Saving…' : 'Save address'}
                    </button>
                    <button
                      type="button"
                      className="dash-btn-ghost"
                      disabled={savingAddr}
                      onClick={closeAddrForm}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
