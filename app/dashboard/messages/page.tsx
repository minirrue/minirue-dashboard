import type { Metadata } from 'next';
import { DashChatView } from '@/components/DashChatView';

export const metadata: Metadata = { title: 'Messages — MiniRue Admin' };

export default function MessagesPage() {
  return <DashChatView />;
}
