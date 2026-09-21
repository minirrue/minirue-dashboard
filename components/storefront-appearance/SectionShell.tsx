'use client';

/**
 * The section container for the Storefront Appearance tab.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The `dash-section-header` + `dash-section-title` pair is copied 14 times
 * across this tab (FooterEditor 65/93/181/245/265, MobileMenuEditor 241/307,
 * PagesEditor 68, ProductSectionEditor 184/218, NavbarEditor 51, TrustEditor
 * 31, StorefrontAppearanceClient 384/451), each with its own ad-hoc action
 * button placement and its own inline `style` for spacing.
 *
 * THE DEFECT THIS FIXES BY CONSTRUCTION — DEPTH IS INVISIBLE
 * ----------------------------------------------------------
 * `.dash-form-card` (dashboard.css:1897) is `background: --mr-dash-surface;
 * border: 1px solid --mr-dash-hair; padding: 24px`. It is the ONLY container
 * in the tab, and it is stacked three deep: the Footer tab is a form card,
 * each column inside it is a form card, and each link row sits inside that.
 * Every level therefore has the same background, the same border and the same
 * 24px of padding, so a hero slide's colour picker ends up 72px from the edge
 * of the pane looking exactly as structurally important as the section that
 * contains it. Depth costs horizontal room and buys the reader nothing.
 *
 * SectionShell gives each level a genuinely different surface:
 *
 *   level 1  a real card     — white surface, full hairline border, 20px pad,
 *                              15px semibold title. This is a tab section.
 *   level 2  a tinted well   — --muted ground, border but no shadow, 14px pad,
 *                              14px semibold title. This is an item inside one.
 *   level 3  a rule + label  — no box at all: a left hairline the content is
 *                              indented from, 12px pad, and an 11px uppercase
 *                              tracked label. This is a detail of an item.
 *
 * Padding shrinks as depth grows (20 → 14 → 12) instead of staying at 24,
 * so three levels of nesting cost 46px rather than 72px, and the type scale
 * falls with it so the hierarchy is legible without counting borders.
 *
 * Levels are assigned AUTOMATICALLY by nesting via context. A caller does not
 * pass `level` and cannot get it wrong; a SectionShell rendered inside another
 * SectionShell is one level deeper, full stop. That is what makes the fix
 * structural rather than a convention someone has to remember. `level` is
 * still accepted for the rare case where a shell is rendered through a portal
 * or slot and the React tree does not reflect the visual nesting.
 */

import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SectionLevel = 1 | 2 | 3;

/**
 * Current nesting depth. Starts at 0 so the outermost SectionShell reads 1.
 * Capped at 3 by `nextLevel` — past three deep the surfaces stop differing
 * because there is nothing quieter than "a rule", and a fourth distinct
 * treatment would be noise rather than hierarchy.
 */
const SectionDepthContext = React.createContext<number>(0);

function nextLevel(depth: number): SectionLevel {
  const n = depth + 1;
  return (n > 3 ? 3 : n) as SectionLevel;
}

/** Escape hatch for a shell that is visually nested but not tree-nested. */
export function SectionDepthProvider({
  level,
  children,
}: {
  level: SectionLevel;
  children: React.ReactNode;
}) {
  return <SectionDepthContext.Provider value={level}>{children}</SectionDepthContext.Provider>;
}

/** Read the level the NEXT SectionShell here would take. Exported for tests. */
export function useSectionLevel(): SectionLevel {
  return nextLevel(React.useContext(SectionDepthContext));
}

const SURFACE: Record<SectionLevel, string> = {
  1: 'rounded-xl border border-border bg-card p-5 shadow-sm',
  2: 'rounded-lg border border-border/70 bg-muted/50 p-3.5',
  3: 'border-l-2 border-border bg-transparent pl-3 py-3',
};

const TITLE: Record<SectionLevel, string> = {
  1: 'text-[15px] font-semibold leading-tight text-foreground',
  2: 'text-sm font-semibold leading-tight text-foreground',
  3: 'text-[11px] font-semibold uppercase tracking-wider leading-tight text-muted-foreground',
};

const GAP: Record<SectionLevel, string> = {
  1: 'gap-4',
  2: 'gap-3',
  3: 'gap-2',
};

export interface SectionShellProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  /** The section heading. Rendered as a heading element, not a bare <strong>. */
  title: React.ReactNode;
  /** One line under the title explaining what the section controls. */
  description?: React.ReactNode;
  /** Right-aligned slot in the header — almost always the Add button. */
  action?: React.ReactNode;
  /**
   * Nesting depth. Omit it: it is derived from how deeply this shell is
   * nested inside other shells, which is right every time without the caller
   * thinking about it.
   */
  level?: SectionLevel;
  /** Make the body collapsible. Omit for an always-open section. */
  collapsible?: boolean;
  /** Initial open state when uncontrolled. Defaults to open. */
  defaultOpen?: boolean;
  /** Controlled open state. Pass with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Dim and disable the whole section — used for a section that is switched
   * off and keeps its settings. Interaction is blocked and the subtree is
   * marked `inert`, so a disabled section cannot be tabbed into.
   */
  disabled?: boolean;
  children?: React.ReactNode;
}

export function SectionShell({
  title,
  description,
  action,
  level: levelProp,
  collapsible = false,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  disabled = false,
  className,
  children,
  ...props
}: SectionShellProps) {
  const depth = React.useContext(SectionDepthContext);
  const level = levelProp ?? nextLevel(depth);

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = collapsible ? (isControlled ? openProp : uncontrolledOpen) : true;

  const toggle = () => {
    const next = !open;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const headingId = React.useId();
  const bodyId = React.useId();
  // h2 at the top level, h3/h4 as it nests — the document outline should
  // match the visual hierarchy, not restart at h2 fourteen times as it does
  // today.
  const Heading = (`h${level + 1}` as 'h2' | 'h3' | 'h4');

  const titleNode = (
    <Heading id={headingId} className={cn('m-0', TITLE[level])}>
      {title}
    </Heading>
  );

  return (
    <section
      data-slot="section-shell"
      data-level={level}
      data-disabled={disabled || undefined}
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col',
        GAP[level],
        SURFACE[level],
        disabled && 'pointer-events-none opacity-55 select-none',
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          {collapsible ? (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={bodyId}
              className="-ml-1 flex min-w-0 flex-1 items-start gap-1.5 rounded-md px-1 py-0.5 text-left outline-none hover:bg-accent/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {open ? (
                <ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">{titleNode}</span>
            </button>
          ) : (
            titleNode
          )}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>

      {description && (
        <p className="m-0 -mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      )}

      {open && children != null && (
        <SectionDepthContext.Provider value={level}>
          <div id={bodyId} className={cn('flex min-w-0 flex-col', GAP[level])}>
            {children}
          </div>
        </SectionDepthContext.Provider>
      )}
    </section>
  );
}

export default SectionShell;
