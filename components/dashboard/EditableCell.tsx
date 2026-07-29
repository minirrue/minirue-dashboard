'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * A table cell that reads as text until you click it, then becomes an input.
 *
 * Built for the order Payments card, where InstaPay ref / Sender / Ref are
 * copied by hand off a transfer screenshot — so they arrive late, arrive
 * mistyped, or arrive after the payment was already recorded. Those cells were
 * static text with no endpoint behind them at all.
 *
 * Idle state stays plain text rather than an always-visible input, because
 * three permanent boxes in a row would read as "fill these in" on the majority
 * of payments that legitimately have none. An em dash means empty, exactly as
 * before.
 *
 * Enter or blur saves, Escape reverts. Escape must not save — an admin who
 * pasted the wrong reference needs a way out that is not "type the old one
 * back from memory".
 */
export default function EditableCell({
  value,
  onSave,
  placeholder = '—',
  ariaLabel,
  maxLength = 160,
}: {
  value: string | null;
  onSave: (next: string | null) => Promise<void>;
  placeholder?: string;
  ariaLabel: string;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape sets this so the blur that follows does not re-save the value the
  // user just abandoned.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditing(false);
      setDraft(value ?? '');
      return;
    }
    const next = draft.trim() === '' ? null : draft.trim();
    if (next === (value ?? null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // Stay in edit mode on failure — closing the input would throw away
      // what they typed and leave them guessing whether it saved.
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${ariaLabel}`}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px 4px',
          margin: '-2px -4px',
          borderRadius: 4,
          font: 'inherit',
          color: 'inherit',
          cursor: 'text',
          textAlign: 'left',
          maxWidth: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}
        className="dash-editable-cell"
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value ?? placeholder}
        </span>
        {/* Without this nothing said these cells were editable — an em dash in
            a table reads as "no value", not as "click me". Dimmed until hover
            so a row of pencils does not compete with the data. */}
        <svg
          className="dash-editable-pencil"
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      disabled={saving}
      maxLength={maxLength}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelledRef.current = true;
          inputRef.current?.blur();
        }
      }}
      style={{
        font: 'inherit',
        width: '100%',
        minWidth: 0,
        padding: '2px 4px',
        borderRadius: 4,
        border: `1px solid ${error ? 'var(--mr-st-danger-fg, #b91c1c)' : 'var(--mr-line)'}`,
        background: 'var(--mr-bg)',
        color: 'var(--mr-fg)',
      }}
    />
  );
}
