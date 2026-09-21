'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useFieldIds } from './FieldRow';

/**
 * An on/off row: switch, name, and the sentence explaining what turning it off
 * actually does.
 *
 * ## The defect this closes
 *
 * There are six of these in the tab and three different style objects between
 * them — SectionCard:42, StorefrontAppearanceClient:454, FooterEditor:68 and
 * :250, PagesEditor:196, ProductSectionEditor:302. Each is a bare
 * `<input type="checkbox">` inside a `<label>` with a hand-written inline
 * `style={{ display: 'flex', alignItems: 'center', gap: 6|8, fontSize: 13 }}`,
 * and the gap, the font size and whether the text sits before or after the box
 * vary by call site. Two of them have help text and it hangs off the end of
 * the label, inside the click target, so clicking the explanation toggles the
 * setting.
 *
 * ## Why the switch is not inside the label
 *
 * A `<label>` wrapping a control makes the entire label a click target, which
 * is the behaviour above: an admin reading "Hidden — keeps its settings, just
 * off the live page", clicking to place a cursor for a copy, toggles the
 * section off. So the switch is a sibling, `aria-labelledby` points at the
 * name, `aria-describedby` at the help, and only the name and the switch are
 * clickable.
 *
 * Radix's Switch also gives this the thing the checkboxes never had: it
 * announces as a switch with an on/off state rather than as a checkbox, which
 * is what these controls actually are — they take effect immediately, they are
 * not part of a form submission.
 */
export interface ToggleRowProps {
  /** What the setting is called. Also the click target. */
  label: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** What being off means. Not clickable; see above. */
  help?: React.ReactNode;
  disabled?: boolean;
  /**
   * `'between'` (the default) puts the switch on the right of a full-width row
   * — the settings-list look. `'start'` puts it first, for a toggle sitting
   * inline in a toolbar such as SectionCard's "Show".
   */
  align?: 'between' | 'start';
  name?: string;
  id?: string;
  className?: string;
}

export function ToggleRow({
  label,
  checked,
  onChange,
  help,
  disabled,
  align = 'between',
  name,
  id,
  className,
}: ToggleRowProps) {
  const ids = useFieldIds(id);

  const switchEl = (
    <Switch
      id={ids.controlId}
      name={name}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      aria-labelledby={ids.labelId}
      aria-describedby={help ? ids.helpId : undefined}
      className="shrink-0"
    />
  );

  const labelEl = (
    <label
      id={ids.labelId}
      htmlFor={ids.controlId}
      className={cn(
        'text-sm leading-none font-medium text-foreground select-none',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      {label}
    </label>
  );

  return (
    <div
      className={cn('flex flex-col gap-1.5', className)}
      data-slot="toggle-row"
      data-state={checked ? 'checked' : 'unchecked'}
    >
      <div
        className={cn(
          'flex items-center gap-3',
          align === 'between' ? 'justify-between' : 'justify-start',
        )}
      >
        {align === 'start' ? (
          <>
            {switchEl}
            {labelEl}
          </>
        ) : (
          <>
            {labelEl}
            {switchEl}
          </>
        )}
      </div>
      {help && (
        <p id={ids.helpId} className="text-xs leading-relaxed text-muted-foreground">
          {help}
        </p>
      )}
    </div>
  );
}

export default ToggleRow;
