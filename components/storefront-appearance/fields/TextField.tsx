'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { FieldRow, describedBy, useFieldIds } from './FieldRow';
import {
  applyTextPolicy,
  counterThresholdFor,
  lengthState,
  type EmptyPolicy,
  type EmptyValue,
} from './text-policy';

/**
 * A single-line text field that knows its own backend limit.
 *
 * ## The defect this closes
 *
 * `maxLength` is set on exactly two inputs in the whole Storefront Appearance
 * tab — ProductSectionEditor:272 and the hex box in HeroSlideColors:143. Over
 * forty other fields have a maximum enforced by zod on the backend and nothing
 * at all on the client: hero eyebrow/headline/sub/tagline/ariaLabel at 200,
 * imageAlt 200, ctaLabel 60, scrollCueLabel 60, badge 60, nav and shortcut
 * labels 60, every href 500, newsletterEyebrow 80, footer tagline 300,
 * legalLine 500, secondaryLine 300, page title 120 and slug 60, and so on.
 *
 * A 250-character headline types in perfectly, looks saved, and then 400s —
 * and because the backend validates the layout as one document, it takes the
 * admin's navbar edits, page edits and every other slide down with it. The
 * error surfaces as a failed save with no indication of which of sixty fields
 * caused it.
 *
 * So `maxLength` here does two things at once. It goes onto the DOM node, so
 * the browser refuses the 201st keystroke, and it drives a counter that
 * appears as the limit approaches so the refusal is never a surprise.
 *
 * Passing no `maxLength` is allowed and means "this column has no maximum" —
 * it should be rare, and it should be a decision rather than an oversight.
 */
export interface TextFieldProps<E extends EmptyPolicy = 'empty'> {
  label: React.ReactNode;
  /** `null`/`undefined` and `''` both render as an empty box. */
  value: string | null | undefined;
  /** Receives `string`, or `string | null` when `emptyAs` is `'null'`. */
  onChange: (next: EmptyValue<E>) => void;
  /** The backend's maximum for this column. */
  maxLength?: number;
  /**
   * Trim leading and trailing whitespace on blur. On by default: no field in
   * this tab wants the spaces, and today only five of them remove any.
   */
  trim?: boolean;
  /** What an emptied field is stored as. Default `'empty'` (`''`). */
  emptyAs?: E;
  help?: React.ReactNode;
  /** A caller-supplied error. Shown alongside the field's own length error. */
  error?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** `'text'` by default; `'url'`, `'email'` and `'search'` for the rest. */
  type?: 'text' | 'url' | 'email' | 'search' | 'tel';
  inputMode?: React.ComponentProps<'input'>['inputMode'];
  autoComplete?: string;
  spellCheck?: boolean;
  name?: string;
  id?: string;
  className?: string;
  /** Escape hatch for the counter's trigger point. See `counterThresholdFor`. */
  counterAt?: number;
}

export function TextField<E extends EmptyPolicy = 'empty'>({
  label,
  value,
  onChange,
  maxLength,
  trim = true,
  emptyAs,
  help,
  error,
  placeholder,
  required,
  disabled,
  type = 'text',
  inputMode,
  autoComplete,
  spellCheck,
  name,
  id,
  className,
  counterAt,
}: TextFieldProps<E>) {
  const ids = useFieldIds(id);
  const policy = (emptyAs ?? 'empty') as E;
  const text = value ?? '';

  const threshold = counterAt ?? (maxLength ? counterThresholdFor(maxLength) : 0);
  const length = maxLength ? lengthState(text.length, maxLength, threshold) : null;

  const lengthError = length?.errorMessage ?? null;
  const shownError = error ?? lengthError;

  /**
   * The `maxLength` attribute stops typing, but it does not stop a paste
   * arriving through a synthetic change in a test, nor a value that was
   * already too long before the limit existed. Slicing here means the field
   * cannot be the source of an over-length value even when the DOM guard is
   * bypassed — while a value that arrived over-length from the server is left
   * alone above, so the admin sees their copy and decides what to cut.
   */
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
      <Input
        id={ids.controlId}
        name={name}
        type={type}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        inputMode={inputMode}
        autoComplete={autoComplete}
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

export default TextField;
