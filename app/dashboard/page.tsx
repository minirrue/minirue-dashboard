import type { Metadata } from 'next';
import OverviewClient from './OverviewClient';

export const metadata: Metadata = { title: 'Overview — MiniRue Admin' };

export default function DashboardPage() {
  return <OverviewClient />;
}
