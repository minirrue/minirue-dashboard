'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { ApiError } from '@/lib/api/client';

export interface DeleteChoiceDialogProps {
  /** What is being deleted, shown in the question. */
  productName: string;
  onSoftDelete: () => Promise<void>;
  /**
   * `force` is passed only after the operator has been shown what a forced
   * delete costs and pressed a second, differently-labelled button.
   */
  onHardDelete: (force?: boolean) => Promise<void>;
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
  /**
   * How many orders the server said reference this record, set only after it
   * refuses. The override is offered in RESPONSE to the refusal rather than
   * sitting on the dialog from the start: an operator who has just been told
   * "4 orders reference this" is making a different, better-informed decision
   * than one who saw a "force" checkbox before they knew there was a problem.
   */
  const [blockedByOrders, setBlockedByOrders] = useState<number | null>(null);

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

  async function handleHard(force = false) {
    setError(null);
    setBusy('hard');
    try {
      await onHardDelete(force);
    } catch (e) {
      const err = e as ApiError & { referencingCount?: number; canForce?: boolean };
      // A 409 that says it CAN be forced is not a dead end, so it is not
      // presented as one.
      if (err.status === 409 && err.canForce && typeof err.referencingCount === 'number') {
        setBlockedByOrders(err.referencingCount);
        setError(null);
      } else {
        setError(err.message ?? 'Hard delete failed. Please try again.');
      }
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

        {blockedByOrders !== null && (
          <div
            style={{
              border: '1px solid var(--mr-dash-danger, #c0392b)',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 12,
            }}
            data-trace-id={`${traceIdPrefix}::EL-REGION-force-delete-warning`}
          >
            <p className="dash-help-text" style={{ margin: 0 }}>
              <strong>
                {blockedByOrders} past order
                {blockedByOrders === 1 ? '' : 's'} reference this.
              </strong>{' '}
              You can still delete it. Those orders are <strong>not</strong>{' '}
              touched and will keep showing what the customer bought and paid —
              the name, code and price are stored on the order itself.
            </p>
            <p className="dash-help-text" style={{ margin: '8px 0 0' }}>
              What you lose: you will not be able to return those orders&rsquo;
              stock to the shelf, because a return looks the item up by this
              record. Refunding the money still works.
            </p>
          </div>
        )}

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
          {blockedByOrders === null ? (
            <button
              type="button"
              className="dash-btn-danger"
              onClick={() => void handleHard(false)}
              disabled={busy !== null}
              data-trace-id={`${traceIdPrefix}::EL-BTN-hard-delete-confirm`}
            >
              {busy === 'hard' ? 'Hard deleting…' : 'Hard Delete'}
            </button>
          ) : (
            // Relabelled, not just re-enabled. The operator is agreeing to
            // something different from what the first button offered, and the
            // button should say which thing.
            <button
              type="button"
              className="dash-btn-danger"
              onClick={() => void handleHard(true)}
              disabled={busy !== null}
              data-trace-id={`${traceIdPrefix}::EL-BTN-force-hard-delete-confirm`}
            >
              {busy === 'hard' ? 'Deleting…' : 'Delete anyway, keep the orders'}
            </button>
          )}
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
