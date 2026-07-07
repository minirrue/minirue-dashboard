'use client';



import Link from 'next/link';

import { usePathname } from 'next/navigation';

import { useEffect, useState, type ReactNode } from 'react';

import {

  apiCollabOverview,

  type CollabModule,

  type CollabOverview,

} from '@/lib/api/collab-portal';

import type { ApiError } from '@/lib/api/client';



const MODULE_LINKS: { module: CollabModule; label: string; href: string }[] = [

  { module: 'ORDERS', label: 'Orders', href: '/collab/orders' },

  { module: 'PRODUCTS', label: 'Products', href: '/collab/products' },

  { module: 'ANALYTICS', label: 'Analytics', href: '/collab/analytics' },

];



export default function CollabLayoutClient({ children }: { children: ReactNode }) {

  const pathname = usePathname();

  const [overview, setOverview] = useState<CollabOverview | null>(null);

  const [error, setError] = useState<string | null>(null);



  useEffect(() => {

    apiCollabOverview()

      .then(setOverview)

      .catch((err: ApiError) => setError(err.message || 'Failed to load partner workspace'));

  }, []);



  const enabled = new Set(overview?.modules ?? []);



  return (

    <div className="collab-portal-shell">

      <div
        className="dash-card collab-portal-header"
        data-trace-id="PG-DASHBOARD-COLLAB-004::EL-REGION-portal-header"
      >

        <div className="collab-portal-header-row">

          <div data-trace-id="PG-DASHBOARD-COLLAB-004::EL-REGION-portal-title">

            <p className="dash-label collab-portal-brand-label">Partner workspace</p>

            <h1 className="dash-page-title" style={{ margin: 0 }}>

              {overview?.displayName || overview?.brandSlug || 'Your brand'}

            </h1>

          </div>

          <Link
            href="/collab/brand"
            className="dash-btn-secondary"
            data-trace-id="PG-DASHBOARD-COLLAB-004::EL-LINK-portal-brand-profile"
          >

            Brand profile

          </Link>

        </div>

        <nav className="collab-portal-nav" aria-label="Partner sections">

          <Link

            href="/collab"

            className="dash-btn-ghost"

            data-active={pathname === '/collab' ? 'true' : undefined}

            data-trace-id="PG-DASHBOARD-COLLAB-004::EL-TAB-portal-nav-overview"

          >

            Overview

          </Link>

          <Link

            href="/collab/profile"

            className="dash-btn-ghost"

            data-active={pathname === '/collab/profile' ? 'true' : undefined}

            data-trace-id="PG-DASHBOARD-COLLAB-004::EL-TAB-portal-nav-profile"

          >

            Profile

          </Link>

          {MODULE_LINKS.filter((l) => enabled.has(l.module)).map((link) => (

            <Link

              key={link.href}

              href={link.href}

              className="dash-btn-ghost"

              data-active={pathname?.startsWith(link.href) ? 'true' : undefined}

              data-trace-id={`PG-DASHBOARD-COLLAB-004::EL-TAB-portal-nav-${link.module.toLowerCase()}`}

            >

              {link.label}

            </Link>

          ))}

        </nav>

        {error ? (
          <p
            className="dash-error collab-portal-error"
            data-trace-id="PG-DASHBOARD-COLLAB-004::EL-REGION-portal-error"
          >
            {error}
          </p>
        ) : null}

      </div>

      {children}

    </div>

  );

}

