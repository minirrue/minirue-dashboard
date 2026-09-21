'use client';

/**
 * LinkTarget — the one "where does this link go" control for Storefront
 * Appearance.
 *
 * The vocabulary, the canonical URLs and the inference all live next door in
 * `link-target-kinds.ts`; read its header first, because it is where the four
 * competing kind lists and the three URL defects are written down. This file is
 * only the control: a kind dropdown over a subset of the registry, the picker
 * that kind needs, and the two storage modes.
 *
 * ## The two modes, and why there are two
 *
 * `stores="target"` is for the call sites that store a structured target —
 * `NavItem`, `CtaTarget`, `MobileMenuTarget`. `value` is the target, `onChange`
 * hands back a target of the same type, including the `{ kind: 'link'; href }`
 * spelling if that is what came in.
 *
 * `stores="href"` is for the footer links, which store a plain string.
 *
 * They are separate components under the hood rather than one component with a
 * branch, for a reason worth stating: href mode has to hold a little state that
 * target mode must not have. In target mode the kind IS the stored value's
 * `kind` field, so there is nothing to keep in sync and nothing that can go
 * stale — which is exactly why the three structured editors never had the bug
 * that `LinkTargetField` did. In href mode the kind is *inferred*, and an empty
 * href infers as `page` whatever the admin just chose, so the choice has to
 * survive in state. Giving target mode that state anyway would be inventing a
 * way for it to drift from its own value.
 *
 * A call site does not change `stores` after mounting, so the two never swap.
 */

import * as React from 'react';
import type { StorefrontPage } from '@/lib/api/storefront';
import EntityPicker, {
  useEntityOptions,
} from '@/app/dashboard/storefront-appearance/pickers/EntityPicker';
import { SelectField, TextField } from './fields';
import { HelpText } from './Messages';
import {
  ALL_LINK_TARGET_KINDS,
  HREF_LINK_KINDS,
  HREF_MAX_LENGTH,
  LINK_TARGET_KINDS,
  blankTarget,
  canKindRepresentHref,
  hrefForTarget,
  isHrefKind,
  nextTargetForKind,
  readStoredTarget,
  resolveTarget,
  targetFromHref,
  writeStoredTarget,
  type LinkTargetContext,
  type LinkTargetKind,
  type LinkTargetValue,
  type StoredLinkTarget,
} from './link-target-kinds';

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export interface LinkTargetCommonProps {
  /**
   * Which kinds this call site offers, in the order it offers them. Omitted
   * means the whole registry (target mode) or every kind with an href
   * projection (href mode) — a subset is the normal case, not the exception.
   */
  kinds?: readonly LinkTargetKind[];
  /** The kind dropdown's label. */
  label?: React.ReactNode;
  /** Per-call-site wording for a kind, e.g. `{ category: 'A category page' }`. */
  kindLabels?: Partial<Record<LinkTargetKind, string>>;
  help?: React.ReactNode;
  error?: React.ReactNode;
  /** The shop's own pages. Required to offer the `page` kind. */
  pages?: readonly StorefrontPage[];
  /** The custom-link box's label and placeholder. */
  urlLabel?: React.ReactNode;
  urlPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

export type LinkTargetProps<T extends StoredLinkTarget = LinkTargetValue> =
  | (LinkTargetCommonProps & {
      /** Stores a structured target — `NavItem`, `CtaTarget`, `MobileMenuTarget`. */
      stores?: 'target';
      value: T;
      onChange: (next: T) => void;
    })
  | (LinkTargetCommonProps & {
      /** Stores a plain href string — footer links. */
      stores: 'href';
      value: string;
      onChange: (next: string) => void;
    });

/* ------------------------------------------------------------------ */
/* The shared controls                                                 */
/* ------------------------------------------------------------------ */

interface ControlsProps extends LinkTargetCommonProps {
  /** Reconciled with `kind` by the caller: `target.kind === kind` always. */
  target: LinkTargetValue;
  kind: LinkTargetKind;
  onKindChange: (kind: LinkTargetKind) => void;
  onTarget: (next: LinkTargetValue) => void;
  offered: readonly LinkTargetKind[];
}

function LinkTargetControls({
  target,
  kind,
  onKindChange,
  onTarget,
  offered,
  label = 'Goes to',
  kindLabels,
  help,
  error,
  pages,
  urlLabel = 'Link',
  urlPlaceholder = '/journal or https://…',
  disabled,
  required,
  id,
  className,
}: ControlsProps) {
  const options = React.useMemo(
    () =>
      offered.map((k) => ({
        value: k,
        label: kindLabels?.[k] ?? LINK_TARGET_KINDS[k].label,
      })),
    [offered, kindLabels],
  );

  const spec = LINK_TARGET_KINDS[kind];
  const entityLabel = kindLabels?.[kind] ?? spec.label;

  return (
    <div className={className} data-slot="link-target">
      <SelectField
        label={label}
        id={id}
        value={kind}
        options={options}
        onChange={(next) => onKindChange(next as LinkTargetKind)}
        help={help}
        error={error}
        required={required}
        disabled={disabled}
      />

      {kind === 'page' && (
        <SelectField
          label="Page"
          value={target.kind === 'page' ? target.slug : ''}
          emptyLabel="Select a page…"
          disabled={disabled}
          options={(pages ?? [])
            .filter((p) => p.slug.trim())
            .map((p) => ({ value: p.slug.trim(), label: p.title || p.slug }))}
          onChange={(slug) => onTarget({ kind: 'page', slug })}
        />
      )}

      {kind === 'category' && (
        <EntityPicker
          kind="category"
          label={entityLabel}
          value={(target.kind === 'category' && target.categoryId) || null}
          onChange={(categoryId) => onTarget({ kind: 'category', categoryId: categoryId ?? '' })}
        />
      )}

      {kind === 'brand' && (
        <EntityPicker
          kind="brand"
          label={entityLabel}
          value={(target.kind === 'brand' && target.brandId) || null}
          onChange={(brandId) => onTarget({ kind: 'brand', brandId: brandId ?? '' })}
        />
      )}

      {kind === 'product' && (
        <EntityPicker
          kind="product"
          label={entityLabel}
          value={(target.kind === 'product' && target.productId) || null}
          onChange={(productId) => onTarget({ kind: 'product', productId: productId ?? '' })}
        />
      )}

      {kind === 'collaborator' && (
        <EntityPicker
          kind="collaborator"
          label={entityLabel}
          value={(target.kind === 'collaborator' && target.collaboratorId) || null}
          onChange={(collaboratorId) =>
            onTarget({ kind: 'collaborator', collaboratorId: collaboratorId ?? '' })
          }
        />
      )}

      {kind === 'url' && (
        <TextField
          label={urlLabel}
          value={target.kind === 'url' ? target.url : ''}
          placeholder={urlPlaceholder}
          maxLength={HREF_MAX_LENGTH}
          disabled={disabled}
          onChange={(url) => onTarget({ kind: 'url', url })}
        />
      )}

      {/* The fixed routes have nothing to pick, so say where they land
          instead of leaving the admin looking at a dropdown and no answer. */}
      {spec.path !== null && <HelpText>Goes to {spec.path} on the storefront.</HelpText>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Target mode                                                         */
/* ------------------------------------------------------------------ */

function TargetLinkTarget<T extends StoredLinkTarget>({
  value,
  onChange,
  kinds,
  ...rest
}: LinkTargetCommonProps & { value: T; onChange: (next: T) => void }) {
  const { target, dialect } = React.useMemo(() => readStoredTarget(value), [value]);
  const offered = kinds ?? ALL_LINK_TARGET_KINDS;

  // The written-back value is the same union member the caller handed in, for
  // the kind in hand — which TypeScript cannot see through the generic, so the
  // assertion is here, once, rather than at each call site.
  const emit = (next: LinkTargetValue) => onChange(writeStoredTarget(next, dialect) as T);

  return (
    <LinkTargetControls
      {...rest}
      offered={offered}
      target={target}
      kind={target.kind}
      onKindChange={(kind) => {
        const next = nextTargetForKind(target, kind);
        // Identity, not equality: `nextTargetForKind` returns the very object
        // it was given when the kind did not change. See its doc comment.
        if (next !== target) emit(next);
      }}
      onTarget={emit}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Href mode                                                           */
/* ------------------------------------------------------------------ */

function HrefLinkTarget({
  value,
  onChange,
  kinds,
  pages,
  ...rest
}: LinkTargetCommonProps & { value: string; onChange: (next: string) => void }) {
  /*
   * Both lists, unconditionally, because the href codec needs them: a category
   * href is built from the category's SLUG and the picker hands back its id, and
   * a legacy `?brand=<name>` has to find the brand it names before it can be
   * shown as chosen. `useEntityOptions` shares one in-flight request per kind
   * across every picker on the page (see EntityPicker's `optionsCache`), so a
   * dozen of these cost one call each, not a dozen.
   */
  const { options: categories } = useEntityOptions('category');
  const { options: brands } = useEntityOptions('brand');

  const pageSlugs = React.useMemo(
    () => (pages ?? []).map((p) => p.slug.trim()).filter(Boolean),
    [pages],
  );

  const ctx = React.useMemo<LinkTargetContext>(
    () => ({ pageSlugs, categories, brands }),
    [pageSlugs, categories, brands],
  );

  const derived = React.useMemo(
    () => resolveTarget(targetFromHref(value, ctx), ctx),
    [value, ctx],
  );

  const offered = React.useMemo(
    () => (kinds ?? HREF_LINK_KINDS).filter(isHrefKind),
    [kinds],
  );

  /*
   * Inference answers over the whole registry, but a call site offers a subset
   * — and an empty href infers as `page`, which a footer CTA offering only
   * {category, brand, custom} does not have. Landing on a kind that is not in
   * the dropdown would leave the select showing its placeholder above a picker
   * for a kind the admin was never offered, so an unoffered answer falls back
   * to the first kind this call site does offer.
   */
  const offeredKind = React.useCallback(
    (k: LinkTargetKind): LinkTargetKind => (offered.includes(k) ? k : (offered[0] ?? 'url')),
    [offered],
  );

  const [kind, setKind] = React.useState<LinkTargetKind>(() => offeredKind(derived.kind));
  const [seenHref, setSeenHref] = React.useState(value);

  /*
   * Defect 2. `LinkTargetField.tsx:43` inferred the kind once, in a `useState`
   * initialiser, and never again — so after a save (`setLayout(result)` replaces
   * the whole layout) a link whose href re-inferred differently kept a dropdown
   * that no longer described it. Re-deriving on every render would be worse, for
   * the reason spelled out on `canKindRepresentHref`, so the sync is conditional:
   * the admin's choice is kept for exactly as long as it stays true of the href.
   */
  if (value !== seenHref) {
    setSeenHref(value);
    if (!canKindRepresentHref(kind, value, ctx)) setKind(offeredKind(derived.kind));
  }

  // Which is why the target shown must be reconciled with the kind: a sticky
  // 'url' over an empty href would otherwise be handed the `page` target that
  // an empty href infers to.
  const shown = kind === derived.kind ? derived : blankTarget(kind);

  const emit = (next: LinkTargetValue) => onChange(hrefForTarget(next, ctx) ?? '');

  return (
    <LinkTargetControls
      {...rest}
      pages={pages}
      offered={offered}
      target={shown}
      kind={kind}
      onKindChange={(next) => {
        // Defect 1. The old picker called `onChange('')` on every change event
        // from the kind select, including one that re-selected the kind already
        // chosen — so picking "Brand" on a link that was already a brand link
        // wiped the saved href.
        if (next === kind) return;
        setKind(next);
        emit(blankTarget(next));
      }}
      onTarget={emit}
    />
  );
}

/* ------------------------------------------------------------------ */
/* The primitive                                                       */
/* ------------------------------------------------------------------ */

export function LinkTarget<T extends StoredLinkTarget = LinkTargetValue>(
  props: LinkTargetProps<T>,
) {
  const { stores, value, onChange, ...common } = props as LinkTargetCommonProps & {
    stores?: 'target' | 'href';
    value: unknown;
    onChange: (next: never) => void;
  };

  if (stores === 'href') {
    return (
      <HrefLinkTarget
        {...common}
        value={value as string}
        onChange={onChange as (next: string) => void}
      />
    );
  }

  return (
    <TargetLinkTarget
      {...common}
      value={value as T}
      onChange={onChange as (next: T) => void}
    />
  );
}

export default LinkTarget;

export * from './link-target-kinds';
