'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { FieldRow, describedBy, useFieldIds } from './FieldRow';

/**
 * A bounded number field that actually enforces its bounds.
 *
 * ## The defect this closes
 *
 * The clamp is written out by hand five times in the tab and one of them is
 * wrong:
 *
 *   HeroEditor:326           `Math.min(30,  Math.max(2,  Number(v)))`
 *   RibbonEditor:60          `Math.min(180, Math.max(10, Number(v)))`
 *   ProductGridEditor:83     `Math.min(24,  Math.max(1,  Number(v)))`
 *   CollabShowcaseEditor:164 `Math.min(24,  Math.max(1,  Number(v)))`
 *   TrustEditor:54           `Math.max(0, Math.trunc(Number(raw)))`
 *
 * The fifth has no `Math.min` at all. It renders `max={3650}` on the input —
 * so the spinner stops at 3650 and the browser marks the field invalid past it
 * — and then ignores its own attribute on the value it stores, because typing
 * (as opposed to spinning) is not constrained by `max`. A returns window of
 * 99999 days goes to the backend and is rejected there, taking the whole
 * layout save with it. The attribute made it look handled.
 *
 * Here min/max/step are props, the input attributes and the stored value are
 * computed from the same three numbers, and there is exactly one clamp.
 *
 * ## Why there is a draft
 *
 * Clamping on every keystroke without one makes a bounded field unusable: in
 * RibbonEditor's 10–180 field, clearing the box and typing "4" for 45 clamps
 * to 10, the box re-renders as "10", and the "5" lands making 105. The four
 * existing sites all have this bug; it is invisible only because the minimums
 * are mostly 1 or 2.
 *
 * So the box shows the admin's own text while they are typing, and the clamped
 * number goes to the parent. The parent therefore sees 10 on the way to 45 —
 * transient and harmless, since it is a number in range — while the admin sees
 * "4", then "45". On blur the draft is dropped and the box snaps to what is
 * actually stored, so it never lies about the saved value.
 */
export interface NumberFieldProps<A extends boolean = false> {
  label: React.ReactNode;
  value: number | null | undefined;
  /** Receives `number`, or `number | null` when `allowEmpty` is `true`. */
  onChange: (next: A extends true ? number | null : number) => void;
  min?: number;
  max?: number;
  /** Also decides integer-ness: a whole-number step means a whole-number value. */
  step?: number;
  /**
   * Whether clearing the box is a legitimate value.
   *
   * `true` for TrustEditor's returns window, where blank means "no window is
   * set" and is materially different from zero. `false` (the default) for
   * HeroEditor's seconds-per-slide, where blank is just a box mid-edit — in
   * that case nothing is emitted until the admin types a number again, so a
   * half-cleared field never writes a 0 or a NaN into the layout.
   */
  allowEmpty?: A;
  /** Rounds to whole numbers. Defaults to whether `step` is a whole number. */
  integer?: boolean;
  /** e.g. `seconds`, `days`. Rendered after the box, and read out with it. */
  unit?: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

/** The single clamp. Every bounded number in the tab goes through this. */
export function clampNumber(
  n: number,
  { min, max, integer }: { min?: number; max?: number; integer: boolean },
): number {
  let out = integer ? Math.trunc(n) : n;
  if (min !== undefined) out = Math.max(min, out);
  if (max !== undefined) out = Math.min(max, out);
  return out;
}

export function NumberField<A extends boolean = false>({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  allowEmpty,
  integer,
  unit,
  help,
  error,
  placeholder,
  required,
  disabled,
  name,
  id,
  className,
}: NumberFieldProps<A>) {
  const ids = useFieldIds(id);
  const isInteger = integer ?? Number.isInteger(step);
  const canBeEmpty = allowEmpty === true;

  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : String(value));

  const emit = (n: number | null) => {
    (onChange as (next: number | null) => void)(n);
  };

  return (
    <FieldRow
      label={label}
      ids={ids}
      help={help}
      error={error}
      required={required}
      className={className}
    >
      <div className="flex items-center gap-2">
        <Input
          id={ids.controlId}
          name={name}
          type="number"
          inputMode={isInteger ? 'numeric' : 'decimal'}
          value={shown}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, {
            unit: Boolean(unit),
            help: Boolean(help),
            error: Boolean(error),
          })}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);

            if (raw.trim() === '') {
              // Only a field that says blank is a value writes one. Everywhere
              // else a cleared box is mid-edit, and Number('') === 0 turning
              // that into a stored zero is how an autoplay interval becomes 0ms.
              if (canBeEmpty) emit(null);
              return;
            }

            const parsed = Number(raw);
            // '-', '1e', '1.' and friends all parse to NaN and are all real
            // waypoints on the way to a number. Hold the draft, emit nothing.
            if (!Number.isFinite(parsed)) return;

            emit(clampNumber(parsed, { min, max, integer: isInteger }));
          }}
          onBlur={() => {
            // Drop the draft so the box shows what is stored rather than what
            // was typed — including when the two differ because of the clamp.
            setDraft(null);
            if (value == null) {
              if (!canBeEmpty && min !== undefined) emit(min);
              return;
            }
            const clamped = clampNumber(value, { min, max, integer: isInteger });
            if (clamped !== value) emit(clamped);
          }}
        />
        {unit && (
          // Described rather than aria-hidden: "30" without "seconds" is a
          // different field to a screen-reader user than it is to a sighted one.
          <span id={`${ids.controlId}-unit`} className="shrink-0 text-sm text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </FieldRow>
  );
}

export default NumberField;
