'use client';

import SupportInboxClient from '@/app/dashboard/support/SupportInboxClient';
import { useUser } from '@/lib/hooks/use-auth';

/**
 * The collaborator's own support desk — task U.
 *
 * SAME component, SAME shell as the admin inbox at /support
 * (app/dashboard/support/SupportInboxClient.tsx, which itself renders
 * components/DashChatView.tsx). This file intentionally does not re-implement
 * any of the three-pane chat markup — a second copy is exactly what this
 * codebase is being de-duplicated away from today, and it would drift the
 * moment either side changed. The only differences from /support are scope
 * (enforced below and server-side, never widened) and this route's own
 * container styling.
 *
 * ── Why the layout was broken ──
 * Every /collab/* page is wrapped by CollabLayoutClient.tsx in a
 * `.collab-portal-shell` div — a padded, gapped flex column meant for the
 * card-shaped content those other pages render. DashChatView's own styles
 * (see DashChatView.tsx's `:has(.mrc-shell)` rules) assume the presence bar
 * and `.mrc-shell` sit directly inside `.dash-content-inner`, exactly as they
 * do on /support (SupportInboxClient returns a bare Fragment, so on the admin
 * route they ARE `.dash-content-inner`'s direct children). Nested one level
 * deeper inside `.collab-portal-shell` instead, `.mrc-shell`'s `flex: 1` had
 * no sized flex parent to grow into, and the wrapper's own `gap: 24px`
 * broke the "flush against the bar above it" spacing DashChatView is styled
 * for — that produced exactly what the owner reported: no page container,
 * a full-bleed status bar, and panes spilling past the viewport edge.
 *
 * The fix neutralises `.collab-portal-shell` for this route only, via
 * `display: contents` scoped with the same `:has()` pattern DashChatView
 * already uses elsewhere in this codebase. That removes the wrapper from the
 * box model — its children (the presence bar, `.mrc-shell`, the toast)
 * become direct flex participants of `.dash-content-inner` again, identical
 * to /support, at every breakpoint including mobile. This is done here,
 * inside the page this task owns, rather than by editing
 * CollabLayoutClient.tsx (owned by another agent right now) or
 * DashChatView.tsx's shared markup.
 *
 * ── Why the loading gate ──
 * A collaborator must NEVER see another desk's conversations, not even for a
 * flash before self-correcting. Every support query (lib/hooks/use-support.ts)
 * is now keyed and gated on the signed-in viewer's own id, which closes the
 * cache-collision route a stale cross-identity result could take. This
 * component adds the other half: it does not mount SupportInboxClient — and
 * so does not fire a single support request — until that viewer id is known.
 * Until then it renders a loading panel, never the inbox's own empty state
 * and never a stale list. "Show nothing yet" is always correct; "show the
 * wrong desk, then correct it" never is.
 */
export default function CollabSupportClient() {
  const { data: user, isLoading } = useUser();
  const viewerKnown = !isLoading && !!user?.userId;

  return (
    <>
      <style>{`
        .collab-portal-shell:has(.mrc-shell) {
          display: contents;
        }
      `}</style>
      {viewerKnown ? (
        <SupportInboxClient showPresence />
      ) : (
        <div className="dash-card" style={{ padding: 32 }} role="status" aria-live="polite">
          <span
            className="dash-skeleton"
            style={{ display: 'block', width: '40%', height: 18, marginBottom: 12 }}
          />
          <span className="dash-skeleton" style={{ display: 'block', width: '70%', height: 14 }} />
        </div>
      )}
    </>
  );
}
