'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  HERO_COLOR_PATTERN,
  contrastWarning,
  parseHexInput,
} from '@/lib/hero-slide-colors';
import { FieldRow, describedBy, useFieldIds } from './FieldRow';
import { counterThresholdFor, lengthState } from './text-policy';

/**
 * The colour field, in its two shapes.
 *
 * ## `mode="hex"` — behaviour lifted from HeroSlideColors, unchanged
 *
 * `app/dashboard/storefront-appearance/editors/HeroSlideColors.tsx` already
 * solved this problem, correctly, and it is pinned by 14 editor tests and 18
 * tests on `lib/hero-slide-colors.ts`. Nothing here is a redesign; this is the
 * same component made reusable, and the three things it gets right are
 * preserved to the letter:
 *
 * 1. **`null` is a real state, and it renders no colour input at all.** A
 *    native `<input type="color">` cannot hold null — an unset one reads
 *    `#000000` — so binding one to a nullable column proposes black for every
 *    unset slot on first render, and the next unrelated save repaints the
 *    whole storefront black. The null state is a button, not a picker. There
 *    is nothing on screen to commit black from. Pressing it seeds the theme's
 *    current colour, never `#000000`.
 *
 * 2. **The hex box is a draft.** Typing `#1a2b3c` passes through `#1`, `#1a`,
 *    `#1a2` … and every one of those fails the backend's regex, which rejects
 *    the WHOLE layout rather than the one field. Only a string matching
 *    {@link HERO_COLOR_PATTERN} is ever pushed up; an unparseable draft is
 *    flagged in place and the last valid value stays saved.
 *
 * 3. **Reset writes a real `null`.** Never `''`, which looks cleared, passes
 *    every `!value` check, and fails the backend regex.
 *
 * Contrast guidance warns and never blocks: `role="status"`, nothing disabled,
 * nothing rejected. A shop owner who wants a low-contrast house style on a
 * dark photograph ships it.
 *
 * ## `mode="free"` — what HeroSlideColors never had to do
 *
 * `HeroEditor:550`, "Background (colour or gradient)", is a bare
 * `<input className="dash-input">` with no swatch, no validation and no length
 * guard, and it drives the entire editorial canvas — the surface all four text
 * runs sit on. An admin types `linear-gradient(180deg #0B0B0B, #1a1a1a)` with
 * the comma missing and gets a transparent hero with no indication why.
 *
 * Free mode accepts any CSS colour or gradient, because that is what the
 * column holds and there is no regex that usefully covers gradients. What it
 * adds is a live swatch painted with the actual string — the fastest possible
 * feedback, since a value the browser cannot parse simply does not paint — a
 * picker when the value happens to be a plain hex, the 500-character limit the
 * column has, and an advisory when the string matches nothing that looks like
 * CSS. Advisory, not a block: `color-mix()`, `var()` and anything CSS ships
 * next year must all still be typeable.
 */

/** What a free-mode string appears to be. Used for the advisory only. */
export type FreeColorShape = 'empty' | 'hex' | 'function' | 'keyword' | 'unknown';

/**
 * Classify a free-form CSS colour or gradient.
 *
 * Deliberately a shape check rather than a validity check. Confirming that
 * `linear-gradient(180deg, #0B0B0B 0%, #1a1a1a 100%)` is valid CSS means
 * implementing a CSS parser; confirming that it is *shaped like* a CSS
 * function is a regex, and it catches the mistakes admins actually make —
 * a half-typed hex, a stray word, a pasted design-tool label.
 */
export function classifyFreeColor(raw: string): FreeColorShape {
  const text = raw.trim();
  if (text === '') return 'empty';
  if (text.startsWith('#')) {
    // 3/6 are the pickable ones; 4/8 are valid CSS with alpha.
    return /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(text) ? 'hex' : 'unknown';
  }
  // `linear-gradient(…)`, `rgb(…)`, `color-mix(…)`, `var(…)` — any CSS function.
  if (/^[a-zA-Z-]+\(.*\)$/.test(text)) return 'function';
  // `transparent`, `currentColor`, `rebeccapurple`.
  if (/^[a-zA-Z]+$/.test(text)) return 'keyword';
  return 'unknown';
}

interface ColorFieldCommonProps {
  label: string;
  help?: React.ReactNode;
  /** A caller-supplied error, shown alongside the field's own. */
  error?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export interface HexColorFieldProps extends ColorFieldCommonProps {
  mode?: 'hex';
  /** `null` means "use the theme default" — a real, renderable state. */
  value: string | null;
  onChange: (next: string | null) => void;
  /**
   * The colour the storefront paints when this field is null, and the colour
   * seeded when the admin presses "Pick a colour". Seeding the theme colour
   * rather than black means the first thing they see is the slide as it
   * already looks, and their first drag is a deliberate move away from it.
   */
  themeDefault: string;
  /**
   * The flat colour this text will sit on, when there is one to measure —
   * `null` over a photograph or a gradient, where the honest answer is "look
   * at the preview", not a made-up number.
   */
  measuredAgainst?: string | null;
  /** The WCAG AA ratio this slot is judged against, by its rendered size. */
  contrastThreshold?: number;
  /** Label for the button that returns the field to the theme. */
  resetLabel?: string;
  /** Label for the button that seeds a colour on an unset field. */
  pickLabel?: string;
}

export interface FreeColorFieldProps extends ColorFieldCommonProps {
  mode: 'free';
  /** Any CSS colour or gradient. Free mode has no null state. */
  value: string;
  onChange: (next: string) => void;
  /** The column's maximum. 500 for `slide.background`. */
  maxLength?: number;
  placeholder?: string;
  /** Trim on blur. On by default. */
  trim?: boolean;
}

export type ColorFieldProps = HexColorFieldProps | FreeColorFieldProps;

/**
 * Advice, not an alarm. `role="status"` rather than `alert` because it is a
 * judgement about readability, and an assertive announcement would interrupt
 * an admin mid-edit — the same trade `contrastWarning` documents.
 */
function ColorAdvice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="text-xs leading-relaxed text-[var(--mr-warning,#b45309)]"
    >
      {children}
    </p>
  );
}

/** A colour chip. `background` takes the raw string, so invalid simply does not paint. */
function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="color-swatch"
      className={cn(
        'inline-block size-9 shrink-0 rounded-md border border-input bg-[length:8px_8px]',
        className,
      )}
      style={{ background: color }}
    />
  );
}

function HexColorField({
  label,
  value,
  onChange,
  themeDefault,
  measuredAgainst = null,
  contrastThreshold,
  resetLabel = 'Theme default',
  pickLabel = 'Pick a colour',
  help,
  error,
  disabled,
  id,
  className,
}: HexColorFieldProps) {
  const ids = useFieldIds(id);

  /**
   * The draft lives here and only a string that parses is pushed up. A draft
   * that never parses is discarded on blur and the box snaps back to what is
   * actually stored, so the box never lies about the saved value.
   */
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? value ?? '';
  const draftIsBad = draft !== null && draft.trim() !== '' && parseHexInput(draft) === null;

  const warning =
    value === null || contrastThreshold === undefined
      ? null
      : contrastWarning(value, measuredAgainst, contrastThreshold, label);

  const draftError = draftIsBad
    ? 'Not a hex colour yet — use #rrggbb or #rgb. The last valid value is still saved.'
    : null;
  const shownError = error ?? draftError;

  return (
    <FieldRow
      label={label}
      ids={ids}
      help={help}
      error={shownError}
      className={className}
      labelAs={value === null ? 'span' : 'label'}
    >
      {value === null ? (
        <div className="flex items-center gap-2">
          <Swatch color={themeDefault} />
          <span className="text-sm text-muted-foreground">Theme default</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="ml-auto"
            onClick={() => {
              setDraft(null);
              onChange(themeDefault);
            }}
          >
            {pickLabel}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={`${label} colour`}
              disabled={disabled}
              className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              value={value}
              onChange={(e) => {
                // A native colour input can only ever emit `#rrggbb`, so this
                // path is contract-safe by construction.
                setDraft(null);
                onChange(e.target.value);
              }}
            />
            <Input
              id={ids.controlId}
              aria-label={`${label} hex code`}
              aria-invalid={draftIsBad ? true : undefined}
              aria-describedby={describedBy(ids, {
                help: Boolean(help),
                error: Boolean(shownError),
              })}
              inputMode="text"
              spellCheck={false}
              disabled={disabled}
              maxLength={7}
              placeholder={themeDefault}
              className="w-28 font-mono"
              value={shown}
              onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                const parsed = parseHexInput(raw);
                if (parsed) onChange(parsed);
              }}
              onBlur={() => setDraft(null)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="ml-auto"
              onClick={() => {
                setDraft(null);
                // A real null. Never '' — an empty string fails the backend
                // regex and takes the whole layout save with it.
                onChange(null);
              }}
            >
              {resetLabel}
            </Button>
          </div>
          {warning && <ColorAdvice>{warning.message}</ColorAdvice>}
        </>
      )}
    </FieldRow>
  );
}

function FreeColorField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  trim = true,
  help,
  error,
  disabled,
  id,
  className,
}: FreeColorFieldProps) {
  const ids = useFieldIds(id);
  const text = value ?? '';

  const shape = classifyFreeColor(text);
  const pickable = HERO_COLOR_PATTERN.test(text.trim());

  const length = maxLength
    ? lengthState(text.length, maxLength, counterThresholdFor(maxLength))
    : null;
  const shownError = error ?? length?.errorMessage ?? null;

  const emit = (raw: string, isBlur: boolean) => {
    const capped = maxLength !== undefined ? raw.slice(0, maxLength) : raw;
    // Free mode has no null state: the column is a non-nullable string, and
    // '' is a legitimate "no background set" that the storefront falls back on.
    onChange(isBlur && trim ? capped.trim() : capped);
  };

  return (
    <FieldRow
      label={label}
      ids={ids}
      help={help}
      error={shownError}
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
      <div className="flex items-center gap-2">
        {/* Painted with the raw string. A value the browser cannot parse does
            not paint, which is faster and more honest than any message. */}
        <Swatch color={text} />
        {pickable && (
          <input
            type="color"
            aria-label={`${label} colour`}
            disabled={disabled}
            className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            value={text.trim().toLowerCase()}
            onChange={(e) => emit(e.target.value, false)}
          />
        )}
        <Input
          id={ids.controlId}
          disabled={disabled}
          maxLength={maxLength}
          placeholder={placeholder ?? '#0B0B0B or linear-gradient(…)'}
          spellCheck={false}
          className="font-mono"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy(ids, {
            help: Boolean(help),
            counter: Boolean(length?.show),
            error: Boolean(shownError),
          })}
          value={text}
          onChange={(e) => emit(e.target.value, false)}
          onBlur={(e) => {
            if (trim) emit(e.target.value, true);
          }}
        />
      </div>
      {shape === 'unknown' && (
        <ColorAdvice>
          {`This does not look like a CSS colour or gradient, so the storefront may paint nothing here. Try a hex like #0B0B0B, or a gradient like linear-gradient(180deg, #0B0B0B, #1A1A1A).`}
        </ColorAdvice>
      )}
    </FieldRow>
  );
}

export function ColorField(props: ColorFieldProps) {
  return props.mode === 'free' ? <FreeColorField {...props} /> : <HexColorField {...props} />;
}

export default ColorField;
