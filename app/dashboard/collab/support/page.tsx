import type { Metadata } from 'next';
import SupportInboxClient from '@/app/dashboard/support/SupportInboxClient';

export const metadata: Metadata = { title: 'Support — MiniRue Collaborator' };

export default function CollabSupportPage() {
  // A partner CAN set their own presence now, if MiniRue granted them the
  // Support module — every space has its own desk since backend 0.55.0, so
  // this is their status, not the shop's. The client only renders the controls
  // when the grant is present, and the server refuses without it either way.
  return <SupportInboxClient showPresence />;
}
