'use client';

import Link from 'next/link';
import RoleBadge from './RoleBadge';
import { roleBrief } from '@/lib/auth/role-brief';
import { isRole } from '@/lib/auth/role';

export interface DashboardRoleWelcomeProps {
  userName: string;
  role?: string;
}

export default function DashboardRoleWelcome({ userName, role }: DashboardRoleWelcomeProps) {
  if (!role || !isRole(role)) return null;

  const brief = roleBrief(role);
  const firstName = userName.split(' ')[0] || userName;

  return (
    <section className="dash-role-welcome" aria-label="Welcome">
      <div className="dash-role-welcome-copy">
        <p className="dash-role-welcome-greeting">Good to see you, {firstName}</p>
        <h1 className="dash-role-welcome-headline" style={{ textWrap: 'balance' }}>
          {brief.headline}
        </h1>
        <p className="dash-role-welcome-description" style={{ textWrap: 'pretty' }}>
          {brief.description}
        </p>
      </div>
      <div className="dash-role-welcome-aside">
        <RoleBadge role={role} />
        <Link href={brief.primaryAction.href} className="dash-btn-ghost dash-role-welcome-cta">
          {brief.primaryAction.label} →
        </Link>
      </div>
    </section>
  );
}
