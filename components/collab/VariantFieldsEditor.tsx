'use client';

import React from 'react';

/**
 * The collab product form's "Variant details" section — Size / 50 ml,
 * Shade / Amber.
 *
 * This is the collab-shaped counterpart of the admin form's Variants section
 * (`app/dashboard/products/[slug]/edit/VariantsSection.tsx`): a collab product
 * is single-variant by construction (`createProductAtomic` inserts exactly one
 * row), so what a partner needs is the fields that describe THAT variant, not
 * a variant list.
 *
 * It lives here, shared, because the Add form had this section and the Edit
 * form did not — a partner could name the fields once and never change them
 * again (owner ask 2026-07-31: "collab must have also all productiosn sections
 * like minirue"). Copying the markup into the second form is exactly how the
 * two drifted apart in the first place, so both import this instead.
 */

export interface VariantField {
  name: string;
  value: string;
}

/** The API cap. The form must never offer a row that would be rejected on save. */
export const MAX_VARIANT_FIELDS = 10;

/**
 * Rows → the `customValues` object the API takes.
 *
 * Only rows with BOTH a name and a value: a half-filled row is someone
 * mid-thought, not data, and an empty key would break the generated SKU.
 */
export function toCustomValues(rows: VariantField[]): Record<string, string> {
  return Object.fromEntries(
    rows
      .map((row) => [row.name.trim(), row.value.trim()] as const)
      .filter(([name, value]) => name && value),
  );
}

/**
 * The saved object → rows for editing. Always leaves one blank row so the
 * section is never an empty box with nothing to type into.
 */
export function toVariantFields(
  customValues: Record<string, string> | undefined | null,
): VariantField[] {
  const rows = Object.entries(customValues ?? {}).map(([name, value]) => ({
    name,
    value,
  }));
  return rows.length > 0 ? rows : [{ name: '', value: '' }];
}

interface Props {
  rows: VariantField[];
  onChange: (rows: VariantField[]) => void;
  disabled?: boolean;
  traceId: string;
}

export default function VariantFieldsEditor({
  rows,
  onChange,
  disabled = false,
  traceId,
}: Props) {
  const setField = (index: number, patch: Partial<VariantField>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="dash-field" data-trace-id={`${traceId}::EL-REGION-variant-fields`}>
      <label className="dash-label">Variant details (optional)</label>
      <p className="dash-help-text" style={{ marginTop: 0, marginBottom: 8 }}>
        What makes this version distinct — e.g. Size / 50 ml, or Shade / Amber.
        These appear on the product and are used to build its SKU.
      </p>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}
        >
          <input
            className="dash-input"
            style={{ flex: '1 1 140px' }}
            placeholder="Field name"
            aria-label={`Custom field ${i + 1} name`}
            value={row.name}
            onChange={(e) => setField(i, { name: e.target.value })}
            disabled={disabled}
            data-trace-id={`${traceId}::EL-INPUT-variant-field-name@${i}`}
          />
          <input
            className="dash-input"
            style={{ flex: '1 1 140px' }}
            placeholder="Value"
            aria-label={`Custom field ${i + 1} value`}
            value={row.value}
            onChange={(e) => setField(i, { value: e.target.value })}
            disabled={disabled}
            data-trace-id={`${traceId}::EL-INPUT-variant-field-value@${i}`}
          />
          {rows.length > 1 && (
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              disabled={disabled}
              data-trace-id={`${traceId}::EL-BTN-remove-variant-field@${i}`}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {rows.length < MAX_VARIANT_FIELDS && (
        <button
          type="button"
          className="dash-btn-secondary"
          onClick={() => onChange([...rows, { name: '', value: '' }])}
          disabled={disabled}
          data-trace-id={`${traceId}::EL-BTN-add-variant-field`}
        >
          + Add field
        </button>
      )}
    </div>
  );
}
