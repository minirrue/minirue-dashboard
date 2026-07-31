import type { Metadata } from 'next';
import SalesClient from './SalesClient';

export const metadata: Metadata = {
  title: 'Sales · Analytics',
};

export default function AnalyticsSalesPage() {
  return <SalesClient />;
}
