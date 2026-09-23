'use client';

import React from 'react';

/** An on/off switch. A real checkbox underneath, so it is keyboard- and form-native. */
export default function Switch({
  checked,
  onChange,
  label,
  stateLabels,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label. */
  label?: string;
  /** Shown instead of `label` to name the state, e.g. ['Shown', 'Hidden']. */
  stateLabels?: [string, string];
  id?: string;
}) {
  const text = stateLabels ? (checked ? stateLabels[0] : stateLabels[1]) : label;
  return (
    <label className="sfe-switch">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={stateLabels ? label : undefined} />
      <span className="sfe-switch-track" aria-hidden />
      {text && <span className="sfe-switch-text">{text}</span>}
    </label>
  );
}
