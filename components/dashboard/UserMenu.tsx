'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RoleBadge from './RoleBadge';
import ErrorBanner from './ErrorBanner';
import { useLogout } from '@/lib/hooks/use-auth';
import { getInitials } from '@/lib/utils/getInitials';

export interface UserMenuProps {
  userName?: string;
  userRole?: string;
}

export default function UserMenu({ userName = 'Admin', userRole }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const logoutMutation = useLogout();

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleLogout = () => {
    setLogoutError(null);
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        router.push('/login');
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Sign out failed. Please try again.';
        setLogoutError(message);
      },
    });
  };

  return (
    <div className="dash-user-menu-wrap" ref={containerRef}>
      {logoutError && (
        <ErrorBanner
          message={logoutError}
          onDismiss={() => setLogoutError(null)}
          traceId="PG-DASHBOARD-IAM-002::EL-REGION-logout-error-banner"
        />
      )}
      <button
        type="button"
        className="dash-user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-trace-id="PG-DASHBOARD-IAM-002::EL-REGION-user-menu"
      >
        <span className="dash-sidebar-footer-avatar" aria-hidden="true">
          {getInitials(userName)}
        </span>
        <span className="dash-user-menu-copy">
          <span className="dash-user-menu-name" title={userName}>
            {userName}
          </span>
          {userRole ? <RoleBadge role={userRole} size="compact" /> : null}
        </span>
        <svg
          className="dash-user-menu-chevron"
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {open && (
        <div className="dash-user-menu-popover" role="menu">
          <button
            type="button"
            className="dash-user-menu-item"
            role="menuitem"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            data-trace-id="PG-DASHBOARD-IAM-002::EL-BTN-sign-out"
          >
            {logoutMutation.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
