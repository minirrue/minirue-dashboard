'use client';

import { type ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard';

const NAV_HREFS = [
  '/dashboard/products',
  '/dashboard/categories',
  '/dashboard/orders',
  '/dashboard/customers',
  '/dashboard/fulfillment',
  '/dashboard/refunds',
  '/dashboard/inventory',
  '/dashboard/analytics',
  '/dashboard/loyalty',
  '/dashboard/settings',
  '/dashboard',
];

function matchActivePath(pathname: string): string {
  for (const href of NAV_HREFS) {
    if (pathname === href || pathname.startsWith(href + '/')) return href;
  }
  return '/dashboard';
}

export default function DashboardLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const hasCookie = document.cookie.split(';').some((c) => c.trim().startsWith('mr-auth='));
    if (!hasCookie) router.replace('/login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardShell activePath={matchActivePath(pathname ?? '/dashboard')}>
      {children}
    </DashboardShell>
  );
}
