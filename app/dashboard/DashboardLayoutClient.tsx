'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard';
import AccessDeniedPanel from '@/components/dashboard/AccessDeniedPanel';
import MaintenancePanel from '@/components/dashboard/MaintenancePanel';
import ActingAsBanner from '@/components/dashboard/ActingAsBanner';
import { getAccessToken } from '@/lib/auth/tokens';
import {
  canAccessDashboardRoute,
  firstAccessibleDashboardRoute,
  isMaintenanceRoute,
  isStaffRole,
  normalizeDashboardPath,
} from '@/lib/auth/roles';
import { Role } from '@/lib/auth/role';
import { useUser } from '@/lib/hooks/use-auth';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

function DashboardContentSkeleton() {
  return (
    <div className="dash-card" style={{ padding: 32 }}>
      <span
        className="dash-skeleton"
        style={{ display: 'block', width: '40%', height: 18, marginBottom: 12 }}
      />
      <span className="dash-skeleton" style={{ display: 'block', width: '70%', height: 14 }} />
    </div>
  );
}

function titleFromSegment(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function DashboardLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activePath = normalizeDashboardPath(pathname ?? '/overview');
  const { data: user, isLoading, isError } = useUser();
  const [mounted, setMounted] = useState(false);

  useMountedEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const hasCookie = document.cookie.split(';').some((c) => c.trim().startsWith('mr-auth='));
    const hasToken = Boolean(getAccessToken());
    if (!hasCookie && !hasToken) {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!mounted || isLoading || !user) return;
    if (
      user.role === Role.STAFF &&
      (pathname === '/collaborators' || pathname?.startsWith('/collaborators/'))
    ) {
      router.replace('/collab/workspace');
    }
  }, [isLoading, mounted, pathname, router, user]);

  useEffect(() => {
    if (!mounted || isLoading) return;
    if (isError || !user || !isStaffRole(user.role)) {
      router.replace('/login');
    }
  }, [isError, isLoading, mounted, router, user]);

  // '/overview' is the universal post-login landing path, but a COLLAB
  // (or any role without staff-console access) doesn't have permission
  // there — without this, they'd land on /overview and see AccessDeniedPanel
  // immediately after signing in, instead of going straight to their own
  // workspace. Only redirects from the default landing spot; a deliberate
  // deep link to a route the role can't reach still shows the denial panel.
  useEffect(() => {
    if (!mounted || isLoading || !user) return;
    if (pathname === '/overview' && !canAccessDashboardRoute(user.role, '/overview')) {
      router.replace(firstAccessibleDashboardRoute(user.role));
    }
  }, [isLoading, mounted, pathname, router, user]);

  const userName = user?.name?.trim() || user?.email?.split('@')[0] || 'Admin';
  const accessDenied =
    Boolean(user) && !canAccessDashboardRoute(user!.role, activePath);
  const showLoadingShell = !mounted || isLoading;
  const pathSegments = activePath.split('/').filter(Boolean);
  const isCollaboratorArea = pathSegments[0] === 'collab';
  const shellEyebrow = isCollaboratorArea ? 'Partner workspace' : 'MiniRue dashboard';
  // Every page's title is its own last path segment (Products, Categories,
  // Settings, Info, ...) — was previously hardcoded to 'Overview' (or
  // 'Workspace' for collab) for ANY single-segment path, so every top-level
  // page showed the wrong topbar title, not just the actual Overview page.
  const shellTitle = titleFromSegment(pathSegments[pathSegments.length - 1] ?? 'overview');

  return (
    <DashboardShell
      activePath={activePath}
      userName={userName}
      userRole={user?.role}
      shellEyebrow={shellEyebrow}
      shellTitle={shellTitle}
    >
      {/* Renders nothing unless a "sign in as" session is running, and sits
          above the loading branch so it is never hidden behind a skeleton. */}
      <ActingAsBanner />
      {showLoadingShell ? (
        <DashboardContentSkeleton />
      ) : accessDenied ? (
        isMaintenanceRoute(activePath) ? (
          <MaintenancePanel role={user!.role} attemptedPath={activePath} />
        ) : (
          <AccessDeniedPanel role={user!.role} attemptedPath={activePath} />
        )
      ) : (
        children
      )}
    </DashboardShell>
  );
}
