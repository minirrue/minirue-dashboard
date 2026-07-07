'use client';

import React, { useState } from 'react';
import type { ApiError } from '@/lib/api/client';

export interface DeleteChoiceDialogProps {
  productName: string;
  onSoftDelete: () => Promise<void>;
  onHardDelete: () => Promise<void>;
  onCancel: () => void;
  traceIdPrefix?: string;
}

export default function DeleteChoiceDialog({
  productName,
  onSoftDelete,
  onHardDelete,
  onCancel,
  traceIdPrefix = 'EL-MODAL-delete-choice',
}: DeleteChoiceDialogProps) {
  const [busy, setBusy] = useState<'soft' | 'hard' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSoft() {
    setError(null);
    setBusy('soft');
    try {
      await onSoftDelete();
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Soft delete failed. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function handleHard() {
    setError(null);
    setBusy('hard');
    try {
      await onHardDelete();
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Hard delete failed. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="dash-dialog-overlay">
      <div className="dash-dialog" data-trace-id={traceIdPrefix}>
        <p className="dash-dialog-message">
          Delete &ldquo;{productName}&rdquo;? Choose how:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
          <div>
            <p className="dash-help-text" style={{ margin: 0 }}>
              <strong>Soft delete:</strong> hidden from all lists immediately, fully recoverable
              later, keeps order history intact.
            </p>
          </div>
          <div>
            <p className="dash-help-text" style={{ margin: 0 }}>
              <strong>Hard delete:</strong> permanently erases this record, cannot be undone.
              Will be blocked if past orders reference this product.
            </p>
          </div>
        </div>

        {error && <p className="dash-inline-error">{error}</p>}

        <div className="dash-form-actions">
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={handleSoft}
            disabled={busy !== null}
            data-trace-id={`${traceIdPrefix}::EL-BTN-soft-delete-confirm`}
          >
            {busy === 'soft' ? 'Soft deleting…' : 'Soft Delete'}
          </button>
          <button
            type="button"
            className="dash-btn-danger"
            onClick={handleHard}
            disabled={busy !== null}
            data-trace-id={`${traceIdPrefix}::EL-BTN-hard-delete-confirm`}
          >
            {busy === 'hard' ? 'Hard deleting…' : 'Hard Delete'}
          </button>
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={onCancel}
            disabled={busy !== null}
            data-trace-id={`${traceIdPrefix}::EL-BTN-delete-cancel`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
