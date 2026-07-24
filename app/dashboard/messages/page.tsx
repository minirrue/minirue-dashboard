import type { Metadata } from 'next';
import SupportInboxClient from '@/app/dashboard/support/SupportInboxClient';

export const metadata: Metadata = { title: 'Messages — MiniRue Admin' };

export default function MessagesPage() {
  return <SupportInboxClient showPresence />;
}
