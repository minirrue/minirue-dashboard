'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

/**
 * The layout wrapper every field in Storefront Appearance sits in.
 *
 * ## Why a wrapper at all
 *
 * The tab currently hand-rolls `<label className="dash-field"><span
 * className="dash-label">…` around every control, and the four things that
 * belong to a field — its name, the control, the help text, the error — are
 * assembled slightly differently at each of the ~60 call sites. The
 * differences are not deliberate: some fields have a `dash-hint` under them,
 * some have it above, some wrap the control in a flex div with an inline
 * `style` object, and error text has no consistent home at all because almost
 * nothing in the tab can currently report a field-level error.
 *
 * Centralising it here means the spacing is decided once, and — the part that
 * actually matters — the ARIA wiring is decided once too. A control needs
 * `aria-describedby` pointing at its help AND its error, and `aria-invalid`
 * when it is wrong. Every field component below uses {@link useFieldIds} to
 * mint those ids and hands the same object to both this row and its control,
 * so the wiring cannot drift out of sync between them.
 *
 * ## Why the label is not always a `<label>` element
 *
 * `htmlFor` only works against a real form control. Radix's Select and Switch
 * render a `<button>`, which `htmlFor` cannot target in every browser, and
 * ColorField's null state has no control at all to point at. So the row takes
 * a `labelAs` escape hatch: `'label'` (the default) for native inputs, and
 * `'span'` for the composite controls, which instead carry their own
 * `aria-labelledby` back to the label's id.
 */

/** The ids a field needs to wire a control to its label, help and error. */
export interface FieldIds {
  /** The control itself. */
  controlId: string;
  /** The label element. Used by composite controls via `aria-labelledby`. */
  labelId: string;
  /** Help text, when there is any. */
  helpId: string;
  /** Error text, when there is any. */
  errorId: string;
}

/**
 * Mint a stable set of ids for one field.
 *
 * `useId` rather than a counter or a random value because these components
 * render on the server: a value that differs between the server pass and the
 * hydration pass produces an `aria-describedby` pointing at nothing, which is
 * invisible to everyone except the screen-reader user it was added for.
 */
export function useFieldIds(explicitId?: string): FieldIds {
  const generated = React.useId();
  const base = explicitId ?? generated;
  return React.useMemo(
    () => ({
      controlId: base,
      labelId: `${base}-label`,
      helpId: `${base}-help`,
      errorId: `${base}-error`,
    }),
    [base],
  );
}

/**
 * Build the `aria-describedby` for a control from whichever of its descriptions
 * actually rendered. Returns undefined rather than an empty string, because an
 * empty `aria-describedby` is a dangling reference, not "no description".
 */
export function describedBy(
  ids: FieldIds,
  opts: { help?: boolean; error?: boolean; counter?: boolean; unit?: boolean },
): string | undefined {
  const parts: string[] = [];
  if (opts.unit) parts.push(`${ids.controlId}-unit`);
  if (opts.help) parts.push(ids.helpId);
  if (opts.counter) parts.push(`${ids.controlId}-counter`);
  if (opts.error) parts.push(ids.errorId);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export interface FieldRowProps {
  /** The field's name, as the admin reads it. */
  label: React.ReactNode;
  /** Ids from {@link useFieldIds}, shared with the control this row wraps. */
  ids: FieldIds;
  /** The control. */
  children: React.ReactNode;
  /** Standing guidance. Always visible; not a place for error text. */
  help?: React.ReactNode;
  /**
   * What is wrong right now. Rendered instead of nothing, never instead of the
   * help — an admin who has just made a mistake still needs the instruction.
   */
  error?: React.ReactNode;
  /**
   * Right-aligned slot on the label line. The character counter lives here, so
   * it is beside the name of the field it counts rather than below the box
   * where it would push the help text around as it appears and disappears.
   */
  adornment?: React.ReactNode;
  /** Marks the field required to both sighted and assistive users. */
  required?: boolean;
  /**
   * `'span'` for composite controls (Select, Switch, ColorField) whose real
   * control is a button that `htmlFor` cannot reliably target.
   */
  labelAs?: 'label' | 'span';
  className?: string;
}

export function FieldRow({
  label,
  ids,
  children,
  help,
  error,
  adornment,
  required,
  labelAs = 'label',
  className,
}: FieldRowProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-slot="field-row">
      <div className="flex items-baseline justify-between gap-3">
        {labelAs === 'label' ? (
          <Label id={ids.labelId} htmlFor={ids.controlId} className="text-foreground">
            {label}
            {required && (
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            )}
            {required && <span className="sr-only">(required)</span>}
          </Label>
        ) : (
          <span
            id={ids.labelId}
            className="flex items-center gap-2 text-sm leading-none font-medium text-foreground select-none"
          >
            {label}
            {required && (
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            )}
            {required && <span className="sr-only">(required)</span>}
          </span>
        )}
        {adornment}
      </div>

      {children}

      {help && (
        <p id={ids.helpId} className="text-xs leading-relaxed text-muted-foreground">
          {help}
        </p>
      )}

      {error && (
        <p
          id={ids.errorId}
          role="status"
          className="text-xs leading-relaxed font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default FieldRow;
