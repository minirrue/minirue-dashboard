import type { Metadata } from 'next';
import CollabSupportClient from './CollabSupportClient';

export const metadata: Metadata = { title: 'Support — MiniRue Collaborator' };

export default function CollabSupportPage() {
  // Same component and shell as /support (app/dashboard/support/page.tsx) —
  // see CollabSupportClient.tsx for why this is a thin wrapper rather than a
  // second copy: it neutralises this route's own `.collab-portal-shell`
  // container (which broke the chat's full-bleed layout) and holds off
  // mounting the inbox at all until the signed-in viewer's own id is known,
  // so a collaborator can never see another desk's conversations, not even
  // for a flash before self-correcting.
  return <CollabSupportClient />;
}
