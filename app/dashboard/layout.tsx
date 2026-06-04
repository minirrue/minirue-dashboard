import type { Metadata } from 'next';
import './dashboard.css';
import DashboardLayoutClient from './DashboardLayoutClient';

export const metadata: Metadata = { title: 'MiniRue Admin' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
