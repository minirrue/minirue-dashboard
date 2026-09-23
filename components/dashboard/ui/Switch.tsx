'use client';

import React from 'react';
import './ui.css';

/**
 * An on/off switch, shared by the Storefront editor and Analytics. A real
 * checkbox underneath, so it is keyboard- and form-native.
 */
export default function Switch({
  checked,
  onChange,
  label,
  stateLabels,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label. */
  label?: string;
  /** Shown instead of `label` to name the state, e.g. ['Shown', 'Hidden']. */
  stateLabels?: [string, string];
  id?: string;
  disabled?: boolean;
}) {
  const text = stateLabels ? (checked ? stateLabels[0] : stateLabels[1]) : label;
  return (
    <label className="mr-switch" data-disabled={disabled || undefined}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={stateLabels ? label : undefined}
      />
      <span className="mr-switch-track" aria-hidden />
      {text && <span className="mr-switch-text">{text}</span>}
    </label>
  );
}
