'use client'

import type { CSSProperties } from 'react'

/**
 * The one generic-profile silhouette used everywhere a person's photo is
 * missing — admin/collaborator profile cards, the collaborator brand-avatar
 * tile, and the support chat rail/thread. Extracted from the admin Settings
 * profile card's inline `<svg>` (the shape the owner picked) so every avatar
 * fallback in this app draws the same icon instead of five copies of the same
 * path, or worse, five DIFFERENT fallbacks (a letter here, a glyph there).
 *
 * Renders at 100% of its parent box by default — every existing avatar slot
 * (`.mrc-avatar`, `.mrc-id-avatar`, `.mrc-msg-avatar`, `.collab-brand-logo`,
 * the Settings 72px tile) already centers its children and clips to a circle,
 * so this component only needs to size itself relative to that box, never
 * assume a fixed pixel size.
 */
export function GenericAvatarIcon({
  size = '55%',
  className,
  style,
}: {
  /** CSS size (both width and height) — percentage sizes ride the parent's
   * existing centering, a fixed px size is also fine for standalone use. */
  size?: number | string
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      data-testid="avatar-generic"
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="No photo"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
