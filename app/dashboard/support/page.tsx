import type { Metadata } from 'next';
import SupportInboxClient from './SupportInboxClient';

export const metadata: Metadata = { title: 'Support — MiniRue Admin' };

export default function SupportPage() {
  return <SupportInboxClient showPresence />;
}
