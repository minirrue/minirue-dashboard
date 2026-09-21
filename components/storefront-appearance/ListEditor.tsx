'use client';

/**
 * One generic list editor for the Storefront Appearance tab.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * List add/remove/reorder is hand-rolled in at least four editors —
 * NavbarEditor (items.map/filter at 47/66), MobileMenuEditor (shortcuts at
 * 221/270), FooterEditor (columns at 60/124 and nested links at 135/149) —
 * plus four separate reorder helpers that all do the same swap:
 * lib/api/storefront.ts:994 (`moveSection`, renumbers `order`),
 * HeroEditor.tsx:104 (`moveSlide`), EntityPicker.tsx:23 (`moveInList`),
 * ProductSectionEditor.tsx:172 (inline, renumbers `order`).
 *
 * Because each was written separately, each drifted separately. This
 * component is the one implementation, and it closes three specific defects
 * BY CONSTRUCTION — a caller cannot reintroduce them, because a caller cannot
 * express them.
 *
 * ── DEFECT 1: three vocabularies for one gesture ──────────────────────────
 * The same swap is labelled "Move up"/"Move down" (SectionCard.tsx:50-60),
 * "Move left"/"Move right" (FooterEditor.tsx:115, CollabShowcaseEditor
 * .tsx:130) and "Up"/"Down" (ProductSectionEditor.tsx:310).
 *
 * THE CHOICE: "Move up" / "Move down", always, with no per-list override.
 *
 * Justification. The control being clicked always sits in a VERTICAL stack of
 * rows in the editor — that is true even of footer columns, which the current
 * code labels "Move left"/"Move right" because that is how they land on the
 * storefront. Labelling the button by its eventual rendered effect rather
 * than by the list the merchant is looking at is a lie about the thing under
 * the cursor: you press "Move left" and the row moves UP the screen. It also
 * breaks the moment a theme reflows those columns, and it is backwards under
 * RTL, which matters for an Arabic-facing shop. DOM order is what assistive
 * technology announces, and DOM order here is top-to-bottom; "up" and "down"
 * are the only labels that agree with both the pixels and the screen reader.
 * The full verb ("Move up", not "Up") is kept because the bare adverb is not
 * a usable accessible name out of context.
 *
 * ── DEFECT 2: destructive removes with no confirmation ────────────────────
 * Twelve removes in this tab delete without asking, while the ONE confirm
 * that exists (StorefrontAppearanceClient.tsx:259) guards the LEAST
 * destructive action — removing a section the merchant could instead just
 * untick. The confirmation is inversely correlated with the damage.
 *
 * So `confirmRemove` is a function OF THE ITEM, not a boolean: it returns the
 * sentence to show, or null for "nothing worth stopping for". The prompt is
 * therefore sized to what is actually destroyed at that moment — a footer
 * column with no links in it can go silently, the same column with five links
 * says so and names the count; a page removal says a whole Markdown body is
 * going; a hero slide says it takes 4 text runs, 2 images and 6 colour
 * overrides. Sizing is computed per item, so an empty row never nags and a
 * heavy one always warns.
 *
 * ── DEFECT 3: caps enforced three different ways, in 3 of 12 lists ────────
 * MobileMenuEditor.tsx:243 HIDES the add button at the cap (the affordance
 * and its explanation vanish together, so the merchant cannot tell whether
 * the feature exists). ProductSectionEditor.tsx:223 DISABLES it (right, but
 * silent about why). NavbarEditor.tsx:115 silently `.slice()`s the excess
 * away (the merchant's work disappears with no message at all). The other
 * nine lists have no client guard, and the backend caps are real: sections
 * 40, hero.slides 8, ribbon.items 20, navbar.items 16, footer.columns 6,
 * columns[].links 12, socials 10, pages 50, collabShowcase.tabs 12,
 * announcement.messages 12, product id lists 24. Blowing any one of them
 * 400s the ENTIRE save across all eight tabs, so an over-long nav list
 * silently costs the merchant their footer edits too.
 *
 * The cap here is one treatment: the button stays VISIBLE and goes
 * `disabled`, and the reason renders next to it. Visible-but-disabled is the
 * only option that answers "can I add another?" with "yes, but not until you
 * remove one" rather than with silence. `add` also re-checks the cap before
 * mutating, so the guard holds even if a caller wires its own button.
 */

import * as React from 'react';
import { ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionShell, type SectionLevel } from './SectionShell';
import { EmptyState, HelpText } from './Messages';

/**
 * Minimum shape of a row. `id` is required and is the React key — every
 * current editor already mints one (`newId('l')`, `newId('perk')`, …), and
 * keying by index is what makes a reordered row carry its neighbour's
 * uncontrolled input state.
 *
 * `order` is optional so lists that do not persist a position still satisfy
 * the constraint; see `renumberOrder`.
 */
export interface ListEditorItem {
  id: string;
  order?: number;
}

export interface ListEditorRenderContext<T> {
  item: T;
  index: number;
  /** Replace this row. Does the `map((x, i) => i === index ? next : x)` for you. */
  update: (next: T) => void;
  /** Total rows, for copy like "1 of 5". */
  total: number;
  disabled: boolean;
}

export interface ListEditorProps<T extends ListEditorItem> {
  /** Section heading, e.g. "Link columns". */
  label: React.ReactNode;
  /** One line under the heading explaining what the list controls. */
  description?: React.ReactNode;
  items: T[];
  onChange: (next: T[]) => void;
  /** Blank-item factory, called on Add. Must mint a fresh unique `id`. */
  createItem: () => T;
  /** The body of one row. The header (number, title, buttons) is ours. */
  renderItem: (ctx: ListEditorRenderContext<T>) => React.ReactNode;
  /** Row header text, e.g. `(item) => item.label || 'Untitled'`. */
  rowTitle?: (item: T, index: number) => React.ReactNode;
  /**
   * Hard cap, matching the backend's. At the cap the Add button is disabled
   * and `capMessage` renders. Omit only for a list the backend does not cap.
   */
  max?: number;
  /** Override the default "That is the maximum…" sentence. */
  capMessage?: React.ReactNode;
  /** Add button text. Defaults to `Add ${itemNoun}`. */
  addLabel?: string;
  /** Singular noun for generated copy, e.g. "column". Defaults to "item". */
  itemNoun?: string;
  /** Empty-state heading. Defaults from `itemNoun`. */
  emptyTitle?: React.ReactNode;
  /** Empty-state body — say what the storefront does with an empty list. */
  emptyDescription?: React.ReactNode;
  /** Show Move up / Move down. Default true. */
  reorderable?: boolean;
  /**
   * Rewrite every row's `order` to its index after any add, remove or move.
   * This is what `moveSection` and ProductSectionEditor's inline `move` each
   * do by hand; the array and the field can then never disagree.
   */
  renumberOrder?: boolean;
  /**
   * Message to confirm removal of this row, or null/undefined for no prompt.
   * Sized to what is destroyed — see DEFECT 2 above.
   */
  confirmRemove?: (item: T, index: number) => string | null | undefined;
  /** Show the Remove button. Default true. */
  removable?: boolean;
  /** Dim and disable the whole list. */
  disabled?: boolean;
  /** Force a nesting level; normally derived from context. */
  level?: SectionLevel;
  /** Extra content between the header and the rows. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The one reorder primitive, replacing `moveSection` / `moveSlide` /
 * `moveInList` / ProductSectionEditor's inline copy. Returns the SAME array
 * reference when the move would fall off either end, so a no-op move cannot
 * mark the form dirty — two of the four originals got this right and the
 * callers could not rely on it.
 */
export function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= list.length) return list;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function ListEditor<T extends ListEditorItem>({
  label,
  description,
  items,
  onChange,
  createItem,
  renderItem,
  rowTitle,
  max,
  capMessage,
  addLabel,
  itemNoun = 'item',
  emptyTitle,
  emptyDescription,
  reorderable = true,
  renumberOrder = false,
  confirmRemove,
  removable = true,
  disabled = false,
  level,
  children,
  className,
}: ListEditorProps<T>) {
  const atCap = max !== undefined && items.length >= max;
  // Tied to the disabled Add button with aria-describedby, so the reason the
  // button is dead is announced with the button rather than stranded beside it.
  const capMessageId = React.useId();

  /**
   * `{ ...item, order: i }` cannot be proved assignable to a generic `T`, but
   * `T extends { order?: number }` makes the widened result structurally
   * sound: we only ever narrow an optional property to a present one.
   */
  const applyOrder = React.useCallback(
    (list: T[]): T[] =>
      renumberOrder ? list.map((item, i) => ({ ...item, order: i }) as T) : list,
    [renumberOrder],
  );

  const commit = React.useCallback(
    (list: T[]) => onChange(applyOrder(list)),
    [applyOrder, onChange],
  );

  const add = () => {
    // Re-checked here, not just on the button: the cap is a data rule, and a
    // caller wiring its own Add elsewhere must not be able to step past it.
    if (disabled || (max !== undefined && items.length >= max)) return;
    commit([...items, createItem()]);
  };

  const remove = (index: number) => {
    if (disabled) return;
    const item = items[index];
    if (item === undefined) return;
    const message = confirmRemove?.(item, index);
    if (message && !window.confirm(message)) return;
    commit(items.filter((_, i) => i !== index));
  };

  const move = (index: number, direction: -1 | 1) => {
    if (disabled) return;
    const next = moveItem(items, index, direction);
    if (next === items) return;
    commit(next);
  };

  const update = (index: number, nextItem: T) => {
    // A plain edit must NOT renumber: it would rewrite `order` on every
    // keystroke and fight a list whose order is deliberately not the index.
    onChange(items.map((item, i) => (i === index ? nextItem : item)));
  };

  const resolvedAddLabel = addLabel ?? `Add ${itemNoun}`;
  const resolvedCapMessage =
    capMessage ??
    `That is the maximum (${max}) — remove one before adding another.`;

  const addButton = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={add}
      disabled={disabled || atCap}
      aria-describedby={atCap ? capMessageId : undefined}
    >
      <Plus aria-hidden="true" />
      {resolvedAddLabel}
    </Button>
  );

  return (
    <SectionShell
      title={label}
      description={description}
      action={addButton}
      level={level}
      disabled={disabled}
      className={className}
    >
      {atCap && (
        <HelpText id={capMessageId} data-slot="list-editor-cap">
          {resolvedCapMessage}
        </HelpText>
      )}

      {children}

      {items.length === 0 ? (
        <EmptyState title={emptyTitle ?? `No ${itemNoun}s yet`}>{emptyDescription}</EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {items.map((item, index) => (
            <li key={item.id} className="min-w-0">
              <SectionShell
                title={
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="shrink-0 tabular-nums text-muted-foreground">{index + 1}.</span>
                    <span className="min-w-0 truncate">
                      {rowTitle ? rowTitle(item, index) : `${itemNoun} ${index + 1}`}
                    </span>
                  </span>
                }
                action={
                  <div className="flex items-center gap-1">
                    {reorderable && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={disabled || index === 0}
                          onClick={() => move(index, -1)}
                          // See DEFECT 1: one vocabulary, always up/down.
                          aria-label="Move up"
                          title="Move up"
                        >
                          <ChevronUp aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={disabled || index === items.length - 1}
                          onClick={() => move(index, 1)}
                          aria-label="Move down"
                          title="Move down"
                        >
                          <ChevronDown aria-hidden="true" />
                        </Button>
                      </>
                    )}
                    {removable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        onClick={() => remove(index)}
                        aria-label="Remove"
                        title="Remove"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                }
              >
                {renderItem({
                  item,
                  index,
                  update: (next) => update(index, next),
                  total: items.length,
                  disabled,
                })}
              </SectionShell>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

export default ListEditor;
