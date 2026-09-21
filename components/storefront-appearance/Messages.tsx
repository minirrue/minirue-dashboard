'use client';

/**
 * The four message roles of the Storefront Appearance tab, each with exactly
 * one treatment.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Today the tab has four incompatible treatments for what are really three
 * roles, and one of them is invisible:
 *
 *   - `.dash-hint` is used 24 times in this tab and has NO CSS rule anywhere
 *     in the repo (grep over every .css file returns nothing). It therefore
 *     renders at full body size in the default foreground colour, which makes
 *     guidance text indistinguishable from the shop's own content. A merchant
 *     reading the Product section cannot tell our advice from their copy.
 *   - `.dash-help-text` IS defined (app/dashboard/dashboard.css:1988 — 13px,
 *     --mr-fg-4, no margin) and is used for the same role two files away.
 *   - `.dash-inline-error` (dashboard.css:2350 — danger fg on danger bg) is
 *     misused for things that are not errors in five places, e.g. "this will
 *     render empty" on ProductGridEditor and CollabShowcaseEditor. Painting a
 *     neutral consequence in alarm red trains merchants to ignore red.
 *   - Empty lists get a bare <p> with no shared shape at all.
 *
 * So: `HelpText` is the one guidance treatment, `Advisory` is the one
 * "consequence you should know about, but nothing is broken" treatment,
 * `InlineError` is reserved for actual failures, and `EmptyState` is the one
 * shape for "there is nothing here yet".
 *
 * The roles are deliberately separated by SEMANTICS as well as colour:
 * Advisory is role="status" (polite), InlineError is role="alert"
 * (assertive). That distinction is the part `.dash-inline-error` could never
 * make, because a single class cannot be both.
 */

import * as React from 'react';
import { Info, TriangleAlert, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* HelpText                                                            */
/* ------------------------------------------------------------------ */

export interface HelpTextProps extends React.ComponentProps<'p'> {
  children: React.ReactNode;
}

/**
 * Guidance from us, not content from the merchant.
 *
 * Replaces both `.dash-hint` (invisible) and `.dash-help-text` (visible) with
 * the visible one's values, expressed in theme tokens: 13px on
 * --muted-foreground. Smaller and quieter than body text, which is the whole
 * point — it has to read as an annotation.
 */
export function HelpText({ className, children, ...props }: HelpTextProps) {
  return (
    <p
      data-slot="help-text"
      className={cn('m-0 text-[13px] leading-relaxed text-muted-foreground', className)}
      {...props}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Advisory                                                            */
/* ------------------------------------------------------------------ */

export interface AdvisoryProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  /** Optional bold lead-in, e.g. "This section will render empty". */
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Set false to drop the icon on very dense rows. */
  icon?: boolean;
}

/**
 * A consequence the merchant should know about, where nothing has failed.
 *
 * "This section will render empty on the storefront" is the canonical case:
 * true, worth saying, and NOT an error — the save will succeed. It is carried
 * in the brand gold rather than danger red, and announced politely
 * (role="status") so a screen reader does not interrupt for it.
 */
export function Advisory({ className, title, children, icon = true, ...props }: AdvisoryProps) {
  return (
    <div
      data-slot="advisory"
      role="status"
      className={cn(
        'flex gap-2 rounded-md border border-accent/45 bg-accent/12 px-3 py-2 text-[13px] leading-relaxed text-foreground',
        className,
      )}
      {...props}
    >
      {icon && <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />}
      <div className="min-w-0">
        {title && <strong className="font-semibold">{title}</strong>}
        {title && ' '}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* InlineError                                                         */
/* ------------------------------------------------------------------ */

export interface InlineErrorProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
  icon?: boolean;
}

/**
 * Something actually failed, or the value in hand cannot be saved.
 *
 * Matches `.dash-inline-error`'s visual intent (danger fg on danger bg) so it
 * is continuous with the rest of the dashboard, but is assertive
 * (role="alert") and is NOT to be used for consequences — those are Advisory.
 */
export function InlineError({ className, children, icon = true, ...props }: InlineErrorProps) {
  return (
    <div
      data-slot="inline-error"
      role="alert"
      className={cn(
        'flex gap-2 rounded-md bg-destructive/12 px-3 py-2 text-[13px] leading-relaxed text-destructive',
        className,
      )}
      {...props}
    >
      {icon && <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

export interface EmptyStateProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  /** What is missing, e.g. "No link columns yet". */
  title: React.ReactNode;
  /** What happens because of that, and/or what to do about it. */
  children?: React.ReactNode;
  /** Usually the same Add button as the section header. */
  action?: React.ReactNode;
}

/**
 * One shape for "there is nothing in this list yet".
 *
 * Dashed rather than solid border so an empty list never reads as a populated
 * card at a glance — the single most common misread of the current editors,
 * where an empty column and a filled one are the same box.
 */
export function EmptyState({ className, title, children, action, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center',
        className,
      )}
      {...props}
    >
      <Info aria-hidden="true" className="size-5 text-muted-foreground" />
      <p className="m-0 text-sm font-medium text-foreground">{title}</p>
      {children && (
        <p className="m-0 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
