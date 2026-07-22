'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listWarehouses, receiveStock } from '@/lib/inventory/api';
import type { WarehouseRow } from '@/lib/inventory/api';
import { apiFetch } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/client';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

interface VariantOption {
  variantId: string;
  label: string;
}

export default function ReceiveStockClient() {
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [warehouseId, setWarehouseId] = useState('');

  const [variantSearch, setVariantSearch] = useState('');
  const debouncedSearch = useDebounce(variantSearch, 300);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<VariantOption | null>(null);

  const [qty, setQty] = useState('');
  const [reference, setReference] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listWarehouses().then((res) => {
      // Guarded: a response missing this key set state to undefined and the
      // next .map()/.reduce() blanked the whole tab. Same bug as Settings
      // and Loyalty had.
      setWarehouses(Array.isArray(res?.data) ? res.data : []);
      if (res.data.length > 0) setWarehouseId(res.data[0].id);
    }).catch(() => {});
  }, []);

  useMountedEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setVariantOptions([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    apiFetch<{ data?: { id: string; name: string }[]; items?: { id: string; name: string }[] }>(
      `/catalog/products?search=${encodeURIComponent(debouncedSearch)}&limit=20`,
      { auth: true },
    )
      .then((res) => {
        const opts: VariantOption[] = [];
        for (const product of (res.items ?? res.data ?? [])) {
          opts.push({ variantId: product.id, label: product.name });
        }
        setVariantOptions(opts);
        setShowDropdown(opts.length > 0);
      })
      .catch(() => {
        setVariantOptions([]);
        setShowDropdown(false);
      })
      .finally(() => setSearchLoading(false));
  }, [debouncedSearch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectVariant(opt: VariantOption) {
    setSelectedVariant(opt);
    setVariantSearch(opt.label);
    setShowDropdown(false);
    setFieldErrors((prev) => ({ ...prev, variant: '' }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!selectedVariant) errs.variant = 'Select a variant';
    if (!warehouseId) errs.warehouse = 'Select a warehouse';
    const parsedQty = parseInt(qty, 10);
    if (!qty || isNaN(parsedQty) || parsedQty <= 0) errs.qty = 'Quantity must be a positive number';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      setSuccessMessage(null);
      if (!validate()) return;

      setSubmitting(true);
      try {
        await receiveStock({
          variantId: selectedVariant!.variantId,
          warehouseId,
          qty: parseInt(qty, 10),
          referenceId: reference.trim() || undefined,
        });
        setSuccessMessage(`Stock received: +${qty} units. Reference: ${reference || 'none'}`);
        setSelectedVariant(null);
        setVariantSearch('');
        setQty('');
        setReference('');
      } catch (e) {
        const err = e as ApiError;
        setSubmitError(err.message ?? 'Failed to receive stock. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [selectedVariant, warehouseId, qty, reference],
  );

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Receive Stock</h1>
        <Link href="/inventory" className="dash-btn-secondary">
          Back to Inventory
        </Link>
      </div>

      <div className="dash-form-card" style={{ maxWidth: 560 }}>
        {successMessage && (
          <div
            className="dash-status"
            data-status="published"
            style={{ padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}
          >
            <span className="dash-status-dot" />
            {successMessage}
            <button
              className="dash-btn-secondary"
              style={{ marginLeft: 'auto', marginTop: 8 }}
              onClick={() => router.push('/inventory')}
            >
              View Inventory
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="dash-inline-form">
            {/* Variant search */}
            <div className="dash-form-section">
              <label className="dash-label" htmlFor="variant-search">Variant</label>
              <div style={{ position: 'relative' }} ref={searchRef}>
                <input
                  id="variant-search"
                  type="text"
                  className={`dash-input${fieldErrors.variant ? ' dash-input-error' : ''}`}
                  placeholder="Search by product name..."
                  value={variantSearch}
                  onChange={(e) => {
                    setVariantSearch(e.target.value);
                    setSelectedVariant(null);
                  }}
                  autoComplete="off"
                />
                {searchLoading && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--mr-fg-4)' }}>
                    Searching...
                  </span>
                )}
                {showDropdown && (
                  <ul
                    role="listbox"
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      background: 'var(--mr-dash-surface)', border: '1px solid var(--mr-dash-hair)',
                      borderRadius: 'var(--mr-radius-md)', marginTop: 2, padding: '4px 0',
                      listStyle: 'none', maxHeight: 240, overflowY: 'auto',
                    }}
                  >
                    {variantOptions.map((opt) => (
                      <li
                        key={opt.variantId}
                        role="option"
                        aria-selected={selectedVariant?.variantId === opt.variantId}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--mr-fg-2)' }}
                        onMouseDown={() => selectVariant(opt)}
                      >
                        {opt.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {fieldErrors.variant && <p className="dash-inline-error">{fieldErrors.variant}</p>}
            </div>

            {/* Warehouse */}
            <div className="dash-form-section">
              <label className="dash-label" htmlFor="warehouse">Warehouse</label>
              <select
                id="warehouse"
                className={`dash-select${fieldErrors.warehouse ? ' dash-input-error' : ''}`}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                {warehouses.length === 0 && <option value="">Loading...</option>}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.locationCode})</option>
                ))}
              </select>
              {fieldErrors.warehouse && <p className="dash-inline-error">{fieldErrors.warehouse}</p>}
            </div>

            {/* Quantity */}
            <div className="dash-form-section">
              <label className="dash-label" htmlFor="qty">Quantity</label>
              <input
                id="qty"
                type="number"
                min="1"
                className={`dash-input${fieldErrors.qty ? ' dash-input-error' : ''}`}
                placeholder="e.g. 50"
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, qty: '' }));
                }}
              />
              {fieldErrors.qty && <p className="dash-inline-error">{fieldErrors.qty}</p>}
            </div>

            {/* Reference */}
            <div className="dash-form-section">
              <label className="dash-label" htmlFor="reference">
                Reference
                <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--mr-fg-4)' }}>
                  PO number or note (optional)
                </span>
              </label>
              <input
                id="reference"
                type="text"
                className="dash-input"
                placeholder="e.g. PO-2026-0041"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            {submitError && <p className="dash-inline-error">{submitError}</p>}

            <div className="dash-form-actions">
              <button type="submit" className="dash-btn-primary" disabled={submitting}>
                {submitting ? 'Receiving...' : 'Receive Stock'}
              </button>
              <Link href="/inventory" className="dash-btn-secondary">Cancel</Link>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
