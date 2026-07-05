'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard';
import AccessDeniedPanel from '@/components/dashboard/AccessDeniedPanel';
import { getAccessToken } from '@/lib/auth/tokens';
import {
  canAccessDashboardRoute,
  isStaffRole,
  normalizeDashboardPath,
} from '@/lib/auth/roles';
import { Role } from '@/lib/auth/role';
import { useUser } from '@/lib/hooks/use-auth';

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

  useEffect(() => {
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
      router.replace('/collab');
    }
  }, [isLoading, mounted, pathname, router, user]);

  useEffect(() => {
    if (!mounted || isLoading) return;
    if (isError || !user || !isStaffRole(user.role)) {
      router.replace('/login');
    }
  }, [isError, isLoading, mounted, router, user]);

  const userName = user?.name?.trim() || user?.email?.split('@')[0] || 'Admin';
  const accessDenied =
    Boolean(user) && !canAccessDashboardRoute(user!.role, activePath);
  const showLoadingShell = !mounted || isLoading;
  const pathSegments = activePath.split('/').filter(Boolean);
  const isCollaboratorArea = pathSegments[0] === 'collab';
  const shellEyebrow = isCollaboratorArea ? 'Partner workspace' : 'MiniRue dashboard';
  const shellTitle =
    pathSegments.length <= 1
      ? isCollaboratorArea
        ? 'Workspace'
        : 'Overview'
      : titleFromSegment(pathSegments[pathSegments.length - 1] ?? 'overview');

  return (
    <DashboardShell
      activePath={activePath}
      userName={userName}
      userRole={user?.role}
      shellEyebrow={shellEyebrow}
      shellTitle={shellTitle}
    >
      {showLoadingShell ? (
        <DashboardContentSkeleton />
      ) : accessDenied ? (
        <AccessDeniedPanel role={user!.role} attemptedPath={activePath} />
      ) : (
        children
      )}
    </DashboardShell>
  );
}
