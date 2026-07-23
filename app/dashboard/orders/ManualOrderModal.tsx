'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { listProducts, getProduct } from '@/lib/catalog/api';
import type { ProductListItem } from '@/lib/catalog/types';
import { apiAdminCreateManualOrder } from '@/lib/api/orders';
import type { ManualOrderInput, Order } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

const SHIPPING_DEFAULT_MINOR = 5000;

interface BasketLine {
  variantId: string;
  label: string;
  unitPriceMinor: number;
  qty: number;
}

export function sumLinesMinor(
  lines: Array<{ unitPriceMinor: number; qty: number }>,
): number {
  return lines.reduce((sum, l) => sum + l.unitPriceMinor * l.qty, 0);
}

/** Pounds typed by the admin -> integer piastres. null when the field is not a usable number. */
export function poundsToMinor(input: string): number | null {
  if (input.trim() === '') return null;
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

const ALLOWED_RECEIPT_TYPES = new Set(['image/png', 'image/jpeg']);

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function egp(minor: number): string {
  return `EGP ${(minor / 100).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}

export default function ManualOrderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (order: Order) => void;
}) {
  // Same "are we on the client yet" pattern as DeleteChoiceDialog — avoids
  // setting state inside an effect (react-hooks/set-state-in-effect) for the
  // createPortal target.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [productId, setProductId] = useState('');
  const [variants, setVariants] = useState<
    Array<{ id: string; label: string; priceMinor: number }>
  >([]);
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState<BasketLine[]>([]);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<ManualOrderInput['paymentMethod']>('INSTAPAY');
  const [markPaid, setMarkPaid] = useState(true);
  const [instapayReference, setInstapayReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState('');
  const [shippingMinor, setShippingMinor] = useState(SHIPPING_DEFAULT_MINOR);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (firstFieldRef.current) {
      firstFieldRef.current.focus();
    } else {
      dialogRef.current?.focus();
    }
  }, []);

  useMountedEffect(() => {
    // listProducts returns { items, total } — not { data }.
    listProducts({ status: 'PUBLISHED', limit: 100 })
      .then((res) => setProducts(res.items))
      .catch(() => setError('Could not load products'));
  }, []);

  const loadVariants = useCallback(async (id: string) => {
    setProductId(id);
    setVariantId('');
    setVariants([]);
    if (!id) return;
    try {
      const product = await getProduct(id);
      // ProductVariant.priceAmount is a number in major units (EGP) here — the
      // dashboard client already parsed the backend's decimal string.
      setVariants(
        (product.variants ?? []).map((v) => ({
          id: v.id,
          label: `${product.name} — ${v.sku}`,
          priceMinor: Math.round(v.priceAmount * 100),
        })),
      );
    } catch {
      setError('Could not load that product’s variants');
    }
  }, []);

  const addLine = () => {
    const v = variants.find((x) => x.id === variantId);
    if (!v || !Number.isFinite(qty) || qty < 1) return;
    setLines((prev) => [
      ...prev.filter((l) => l.variantId !== v.id),
      { variantId: v.id, label: v.label, unitPriceMinor: v.priceMinor, qty },
    ]);
    setQty(1);
  };

  const subtotalMinor = useMemo(() => sumLinesMinor(lines), [lines]);
  const totalMinor = subtotalMinor + shippingMinor;

  const canSubmit =
    lines.length > 0 &&
    fullName.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    Number.isFinite(shippingMinor) &&
    lines.every(
      (l) => Number.isFinite(l.unitPriceMinor) && Number.isFinite(l.qty) && l.qty >= 1,
    );

  const handleReceipt = async (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_RECEIPT_TYPES.has(file.type)) {
      setError('Receipt must be a PNG or JPEG image');
      return;
    }
    setReceiptName(file.name);
    try {
      setReceiptDataUrl(await fileToDataUrl(file));
    } catch {
      setReceiptName('');
      setReceiptDataUrl(null);
      setError('Could not read that receipt file — try again');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const order = await apiAdminCreateManualOrder({
        guest: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
        },
        items: lines.map((l) => ({
          variantId: l.variantId,
          qty: l.qty,
          unitPriceOverrideMinor: l.unitPriceMinor,
        })),
        paymentMethod,
        markPaid,
        ...(instapayReference.trim()
          ? { instapayReference: instapayReference.trim() }
          : {}),
        ...(payerName.trim() ? { payerName: payerName.trim() } : {}),
        ...(receiptDataUrl ? { receiptDataUrl } : {}),
        shippingAmountMinor: shippingMinor,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onCreated(order);
    } catch (err) {
      setError((err as ApiError).message ?? 'Could not create the order');
    } finally {
      setSaving(false);
    }
  };

  // Rendered into <body>, same as DeleteChoiceDialog — .dash-modal/.dash-modal-
  // backdrop do not exist in dashboard.css, so this reuses the confirm-dialog
  // overlay classes (.dash-dialog-overlay / .dash-dialog) instead of inventing
  // new CSS. The inline maxWidth override beats the dialog's 400px cap because
  // an inline style always wins over a class rule on the same element.
  if (!mounted) return null;

  return createPortal(
    <div
      className="dash-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="New manual order"
    >
      <div
        ref={dialogRef}
        className="dash-dialog"
        tabIndex={-1}
        style={{ maxWidth: 720, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="dash-section-header">
          <h2 className="dash-section-title">New manual order</h2>
          <button type="button" className="dash-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)}>
          <div className="dash-form-section">
            <p className="dash-label">Buyer (no account — recorded as a guest)</p>
            <div className="dash-field-row">
              <label className="dash-field">
                <span className="dash-label">Full name</span>
                <input
                  ref={firstFieldRef}
                  className="dash-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </label>
              <label className="dash-field">
                <span className="dash-label">Phone</span>
                <input
                  className="dash-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </label>
              <label className="dash-field">
                <span className="dash-label">Email (optional)</span>
                <input
                  className="dash-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="dash-form-section">
            <p className="dash-label">Products</p>
            <div className="dash-field-row">
              <label className="dash-field">
                <span className="dash-label">Product</span>
                <select
                  className="dash-input"
                  value={productId}
                  onChange={(e) => void loadVariants(e.target.value)}
                >
                  <option value="">Select…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brandName ? `${p.brandName} — ` : ''}
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dash-field">
                <span className="dash-label">Variant</span>
                <select
                  className="dash-input"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  disabled={!variants.length}
                >
                  <option value="">Select…</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} · {egp(v.priceMinor)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dash-field">
                <span className="dash-label">Qty</span>
                <input
                  className="dash-input"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (Number.isFinite(n)) setQty(Math.max(1, n));
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              className="dash-btn-secondary"
              onClick={addLine}
              disabled={!variantId}
            >
              Add to order
            </button>

            {lines.length > 0 && (
              <div className="dash-table-wrap" style={{ marginTop: 12 }}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ textAlign: 'right' }}>Unit</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Line</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.variantId}>
                        <td>{l.label}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            className="dash-input"
                            type="number"
                            min={0}
                            step="0.01"
                            style={{ width: 110, textAlign: 'right' }}
                            value={(l.unitPriceMinor / 100).toFixed(2)}
                            onChange={(e) => {
                              const minor = poundsToMinor(e.target.value);
                              if (minor === null) return;
                              setLines((prev) =>
                                prev.map((x) =>
                                  x.variantId === l.variantId
                                    ? { ...x, unitPriceMinor: minor }
                                    : x,
                                ),
                              );
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>{l.qty}</td>
                        <td style={{ textAlign: 'right' }}>
                          {egp(l.unitPriceMinor * l.qty)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="dash-btn-ghost"
                            onClick={() =>
                              setLines((prev) =>
                                prev.filter((x) => x.variantId !== l.variantId),
                              )
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="dash-form-section">
            <p className="dash-label">Payment</p>
            <div className="dash-field-row">
              <label className="dash-field">
                <span className="dash-label">Method</span>
                <select
                  className="dash-input"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as ManualOrderInput['paymentMethod'])
                  }
                >
                  <option value="INSTAPAY">Instapay transfer</option>
                  <option value="MANUAL">Cash / in person</option>
                  <option value="COD">Cash on delivery</option>
                </select>
              </label>
              <label className="dash-field">
                <span className="dash-label">Shipping charge (EGP)</span>
                <input
                  className="dash-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={(shippingMinor / 100).toFixed(2)}
                  onChange={(e) => {
                    const minor = poundsToMinor(e.target.value);
                    if (minor !== null) setShippingMinor(minor);
                  }}
                />
              </label>
              <label
                className="dash-field"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={markPaid}
                  onChange={(e) => setMarkPaid(e.target.checked)}
                />
                <span>Money already received</span>
              </label>
            </div>

            {paymentMethod === 'INSTAPAY' && (
              <div className="dash-field-row">
                <label className="dash-field">
                  <span className="dash-label">Instapay reference (optional)</span>
                  <input
                    className="dash-input"
                    value={instapayReference}
                    onChange={(e) => setInstapayReference(e.target.value)}
                  />
                </label>
                <label className="dash-field">
                  <span className="dash-label">Sender name (optional)</span>
                  <input
                    className="dash-input"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                  />
                </label>
                <label className="dash-field">
                  <span className="dash-label">Receipt screenshot (optional)</span>
                  <input
                    className="dash-input"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => void handleReceipt(e.target.files?.[0])}
                  />
                  {receiptName && (
                    <span style={{ fontSize: 12, color: 'var(--mr-fg-3)' }}>
                      {receiptName}
                    </span>
                  )}
                </label>
              </div>
            )}
          </div>

          <div className="dash-form-section">
            <label className="dash-field">
              <span className="dash-label">Notes (optional)</span>
              <textarea
                className="dash-textarea"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <p style={{ fontSize: 14 }}>
              Subtotal {egp(subtotalMinor)} · Shipping {egp(shippingMinor)} ·{' '}
              <strong>Total {egp(totalMinor)}</strong>
            </p>
          </div>

          {error && <p className="dash-inline-error">{error}</p>}

          <div className="dash-form-actions">
            <button type="button" className="dash-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="dash-btn-primary"
              disabled={!canSubmit || saving}
            >
              {saving ? 'Creating…' : 'Create order'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
