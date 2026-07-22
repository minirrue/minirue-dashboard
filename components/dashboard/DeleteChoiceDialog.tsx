'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { ApiError } from '@/lib/api/client';

export interface DeleteChoiceDialogProps {
  /** What is being deleted, shown in the question. */
  productName: string;
  onSoftDelete: () => Promise<void>;
  onHardDelete: () => Promise<void>;
  onCancel: () => void;
  traceIdPrefix?: string;
  /**
   * What hard delete actually does here. Products say "blocked if past orders
   * reference it"; option lists say "also cleared from the products using it".
   * Left as the product wording by default so existing callers are unchanged.
   */
  hardDeleteNote?: string;
}

export default function DeleteChoiceDialog({
  productName,
  onSoftDelete,
  onHardDelete,
  onCancel,
  traceIdPrefix = 'EL-MODAL-delete-choice',
  hardDeleteNote = 'Will be blocked if past orders reference this product.',
}: DeleteChoiceDialogProps) {
  // "Are we on the client yet?" without setting state inside an effect, which
  // forces a second render pass (react-hooks/set-state-in-effect).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
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

  // Rendered into <body>. The overlay is position:fixed, and .dash-card sets a
  // transform, which makes the card a containing block -- the backdrop was
  // covering only the card it was rendered inside instead of the page. The
  // frontend notes call this out explicitly: never put a transform on a parent
  // of position:fixed children.
  if (!mounted) return null;

  return createPortal(
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
              <strong>Hard delete:</strong> permanently erases this record, cannot be undone.{' '}
              {hardDeleteNote}
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
    </div>,
    document.body,
  );
}
