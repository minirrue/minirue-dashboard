import type { Metadata } from 'next';
import EmailOperationsClient from './EmailOperationsClient';

export const metadata: Metadata = { title: 'Email — MiniRue Admin' };

export default function EmailOperationsPage() {
  return <EmailOperationsClient />;
}
