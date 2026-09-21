'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { FieldRow, describedBy, useFieldIds } from './FieldRow';
import {
  applyTextPolicy,
  counterThresholdFor,
  lengthState,
  type EmptyPolicy,
  type EmptyValue,
} from './text-policy';

/**
 * The multi-line half of {@link TextField}, with the same limit and policy
 * contract.
 *
 * Separate from TextField rather than a `multiline` prop because the two take
 * genuinely different props — `rows`, and no `type`/`inputMode`/`autoComplete`
 * — and because a boolean that swaps the rendered element is the kind of prop
 * that quietly accumulates `multiline ? … : …` branches inside.
 *
 * The limits here are the long ones, and they are the ones that hurt most when
 * they blow: `background` 500, `newsletterBlurb` 400, footer `legalLine` 500,
 * journal `body` 4000, page `body` 50000. A page body typed past 50000 loses
 * the whole layout save, and the admin has no way to know which of the five
 * pages they were editing is the one that is too long.
 */
export interface TextAreaFieldProps<E extends EmptyPolicy = 'empty'> {
  label: React.ReactNode;
  value: string | null | undefined;
  onChange: (next: EmptyValue<E>) => void;
  /** The backend's maximum for this column. */
  maxLength?: number;
  /** Trim on blur. On by default. */
  trim?: boolean;
  /** What an emptied field is stored as. Default `'empty'` (`''`). */
  emptyAs?: E;
  rows?: number;
  help?: React.ReactNode;
  error?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  spellCheck?: boolean;
  name?: string;
  id?: string;
  className?: string;
  counterAt?: number;
}

export function TextAreaField<E extends EmptyPolicy = 'empty'>({
  label,
  value,
  onChange,
  maxLength,
  trim = true,
  emptyAs,
  rows = 4,
  help,
  error,
  placeholder,
  required,
  disabled,
  spellCheck,
  name,
  id,
  className,
  counterAt,
}: TextAreaFieldProps<E>) {
  const ids = useFieldIds(id);
  const policy = (emptyAs ?? 'empty') as E;
  const text = value ?? '';

  const threshold = counterAt ?? (maxLength ? counterThresholdFor(maxLength) : 0);
  const length = maxLength ? lengthState(text.length, maxLength, threshold) : null;

  const lengthError = length?.errorMessage ?? null;
  const shownError = error ?? lengthError;

  const emit = (raw: string, isBlur: boolean) => {
    const capped = maxLength !== undefined ? raw.slice(0, maxLength) : raw;
    onChange(applyTextPolicy(capped, { trim: isBlur && trim, emptyAs: policy }));
  };

  return (
    <FieldRow
      label={label}
      ids={ids}
      help={help}
      error={shownError}
      required={required}
      className={className}
      adornment={
        length?.show ? (
          <span
            id={`${ids.controlId}-counter`}
            aria-live="polite"
            className={cn(
              'text-xs tabular-nums',
              length.over ? 'font-medium text-destructive' : 'text-muted-foreground',
            )}
          >
            {length.message}
          </span>
        ) : null
      }
    >
      <Textarea
        id={ids.controlId}
        name={name}
        rows={rows}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        spellCheck={spellCheck}
        maxLength={maxLength}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={describedBy(ids, {
          help: Boolean(help),
          counter: Boolean(length?.show),
          error: Boolean(shownError),
        })}
        onChange={(e) => emit(e.target.value, false)}
        onBlur={(e) => {
          if (trim || policy === 'null') emit(e.target.value, true);
        }}
      />
    </FieldRow>
  );
}

export default TextAreaField;
