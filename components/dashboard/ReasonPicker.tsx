'use client';

import { useId } from 'react';

export interface ReasonOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

interface ReasonPickerProps<T extends string> {
  label: string;
  options: readonly ReasonOption<T>[];
  value: T;
  onChange: (value: T) => void;
  note: string;
  onNoteChange: (note: string) => void;
  otherValue: T;
  disabled?: boolean;
  error?: string;
  noteLabel?: string;
  notePlaceholder?: string;
  noteMaxLength?: number;
  showOptionalNote?: boolean;
}

export function ReasonPicker<T extends string>({
  label, options, value, onChange, note, onNoteChange, otherValue,
  disabled = false, error, noteLabel = 'Explain the reason',
  notePlaceholder = 'Add the detail the team will need later',
  noteMaxLength = 500, showOptionalNote = false,
}: ReasonPickerProps<T>) {
  const id = useId();
  const orderedOptions = [...options].sort((left, right) => {
    if (left.value === otherValue) return 1;
    if (right.value === otherValue) return -1;
    return 0;
  });
  const useRadios = orderedOptions.length <= 6;
  const showNote = value === otherValue || showOptionalNote;
  const noteRequired = value === otherValue;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="reason-picker" data-mode={useRadios ? 'radios' : 'select'}>
      {useRadios ? (
        <fieldset className="reason-picker__fieldset" disabled={disabled} aria-describedby={errorId}>
          <legend className="dash-label">{label}</legend>
          <div className="reason-picker__choices">
            {orderedOptions.map((option) => (
              <label className="reason-picker__choice" key={option.value} data-selected={value === option.value}>
                <input type="radio" name={`${id}-reason`} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
                <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <label className="dash-field" htmlFor={`${id}-select`}>
          <span className="dash-label">{label}</span>
          <select id={`${id}-select`} className="dash-select" value={value} disabled={disabled} aria-describedby={errorId} onChange={(event) => onChange(event.target.value as T)}>
            {orderedOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      )}
      {showNote && (
        <label className="dash-field reason-picker__note" htmlFor={`${id}-note`}>
          <span className="dash-label">{noteRequired ? noteLabel : 'Internal note'}{!noteRequired && <span className="reason-picker__optional"> (optional)</span>}</span>
          <textarea id={`${id}-note`} className={`dash-textarea${error ? ' dash-input-error' : ''}`} rows={3} maxLength={noteMaxLength} required={noteRequired} disabled={disabled} value={note} aria-invalid={Boolean(error)} aria-describedby={errorId} placeholder={notePlaceholder} onChange={(event) => onNoteChange(event.target.value)} />
        </label>
      )}
      {error && <p id={errorId} className="dash-field-error" role="alert">{error}</p>}
    </div>
  );
}
