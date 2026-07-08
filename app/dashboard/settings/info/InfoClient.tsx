'use client';

import { CHANGELOG } from '@/lib/changelog';
import packageJson from '@/package.json';
import SettingsTabs from '../SettingsTabs';

const TRACE = 'PG-DASHBOARD-SET-002';

function groupByDate(): { date: string; entries: typeof CHANGELOG }[] {
  const groups = new Map<string, typeof CHANGELOG>();
  for (const entry of CHANGELOG) {
    const existing = groups.get(entry.date);
    if (existing) existing.push(entry);
    else groups.set(entry.date, [entry]);
  }
  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, entries]) => ({ date, entries }));
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function InfoClient() {
  const groups = groupByDate();

  return (
    <>
      <div className="dash-page-header" data-trace-id={`${TRACE}::EL-REGION-info-page-header`}>
        <h1 className="dash-page-title">Info</h1>
      </div>

      <SettingsTabs />

      <div className="dash-card" style={{ marginBottom: 20 }} data-trace-id={`${TRACE}::EL-REGION-info-intro`}>
        <p className="dash-help-text" style={{ margin: 0 }}>
          A running list of what's been fixed or added to your dashboard, written in plain
          language — no technical terms. You're currently on version{' '}
          <strong>{packageJson.version}</strong>. Try out anything below yourself to see it
          working.
        </p>
      </div>

      {groups.map((group) => (
        <div key={group.date} style={{ marginBottom: 24 }}>
          <h2 className="dash-section-title" style={{ marginBottom: 10 }}>
            {formatDate(group.date)}
          </h2>
          <div
            className="dash-card"
            style={{ padding: 0, overflow: 'hidden' }}
            data-trace-id={`${TRACE}::EL-LIST-info-entries@${group.date}`}
          >
            {group.entries.map((entry, i) => (
              <div
                key={i}
                className="dash-info-entry"
                data-trace-id={`${TRACE}::EL-ITEM-info-entry@${group.date}-${i}`}
              >
                <span className="dash-info-entry-area">{entry.area}</span>
                <p className="dash-info-entry-summary">{entry.summary}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
