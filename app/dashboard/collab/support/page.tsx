import type { Metadata } from 'next';
import SupportInboxClient from '@/app/dashboard/support/SupportInboxClient';

export const metadata: Metadata = { title: 'Support — MiniRue Collaborator' };

export default function CollabSupportPage() {
  // Collaborators can't set their own presence status, so no presence UI here.
  return <SupportInboxClient />;
}
