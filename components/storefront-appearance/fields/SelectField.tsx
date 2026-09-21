'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FieldRow, describedBy, useFieldIds } from './FieldRow';
import type { EmptyPolicy, EmptyValue } from './text-policy';

/**
 * A choice field with the same empty policy as the text fields.
 *
 * ## The sentinel, and why it has to exist
 *
 * Every `<select>` in the tab today spells "no choice" as `<option value="">`
 * and reads it back with `e.target.value || null` — HeroEditor's bottle and
 * cap at 558 and 568, ProductGridEditor:89, CollabShowcaseEditor:158. Radix's
 * Select, which is what shadcn wraps, refuses an item whose value is the empty
 * string: it throws, because internally `''` is how it represents "nothing
 * selected" and an item that means that is indistinguishable from the
 * placeholder.
 *
 * So the empty choice carries a sentinel through Radix and is translated back
 * at this boundary. The sentinel never leaves this file — callers see `null`
 * or `''` according to `emptyAs`, exactly as they do from TextField, and the
 * eleven hand-written `|| null` conversions become one prop.
 */
const EMPTY_VALUE = '__sa_field_empty__';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectFieldProps<E extends EmptyPolicy = 'empty'> {
  label: React.ReactNode;
  value: string | null | undefined;
  /** Receives `string`, or `string | null` when `emptyAs` is `'null'`. */
  onChange: (next: EmptyValue<E>) => void;
  options: readonly SelectOption[];
  /** What an explicitly-emptied field is stored as. Default `'empty'`. */
  emptyAs?: E;
  /**
   * The label for an explicit "no choice" item — `"None"` on the hero's bottle
   * and cap. Omitting it means the field cannot be emptied once set, which is
   * right for a mode switch and wrong for an optional decoration.
   */
  emptyLabel?: React.ReactNode;
  /** Shown while nothing is selected and there is no empty item to select. */
  placeholder?: string;
  help?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
  /** The trigger stretches to its container by default. */
  triggerClassName?: string;
}

export function SelectField<E extends EmptyPolicy = 'empty'>({
  label,
  value,
  onChange,
  options,
  emptyAs,
  emptyLabel,
  placeholder,
  help,
  error,
  required,
  disabled,
  name,
  id,
  className,
  triggerClassName,
}: SelectFieldProps<E>) {
  const ids = useFieldIds(id);
  const policy = (emptyAs ?? 'empty') as E;
  const clearable = emptyLabel !== undefined;

  const isEmpty = value == null || value === '';
  // With no empty item there is nothing for Radix to select, so leave it
  // uncontrolled-empty and let the placeholder show.
  const radixValue = isEmpty ? (clearable ? EMPTY_VALUE : undefined) : value;

  return (
    <FieldRow
      label={label}
      ids={ids}
      help={help}
      error={error}
      required={required}
      className={className}
      // Radix renders a <button>, which htmlFor cannot target; the trigger
      // points back at the label with aria-labelledby instead.
      labelAs="span"
    >
      <Select
        value={radixValue}
        disabled={disabled}
        name={name}
        required={required}
        onValueChange={(next) => {
          const out = next === EMPTY_VALUE ? '' : next;
          (onChange as (v: string | null) => void)(
            out === '' && policy === 'null' ? null : out,
          );
        }}
      >
        <SelectTrigger
          id={ids.controlId}
          aria-labelledby={ids.labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, { help: Boolean(help), error: Boolean(error) })}
          className={cn('w-full', triggerClassName)}
        >
          <SelectValue placeholder={placeholder ?? 'Choose…'} />
        </SelectTrigger>
        <SelectContent>
          {clearable && <SelectItem value={EMPTY_VALUE}>{emptyLabel}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldRow>
  );
}

export default SelectField;
