'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Store settings', href: '/settings' },
  { label: 'Info', href: '/settings/info' },
];

export default function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="dash-settings-tabs"
      aria-label="Settings sections"
      data-trace-id="PG-DASHBOARD-SET-001::EL-TABS-settings-sections"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="dash-settings-tab"
          data-active={pathname === tab.href ? 'true' : undefined}
          data-trace-id={`PG-DASHBOARD-SET-001::EL-TAB-settings-${tab.label === 'Info' ? 'info' : 'store'}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
