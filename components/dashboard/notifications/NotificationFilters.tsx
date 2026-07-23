'use client';

import React from 'react';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_SEVERITIES,
  type NotificationCategory,
  type NotificationSeverity,
  type NotificationSort,
} from '@/lib/api/notifications';
import type { NotificationFilterState } from './useAdminNotifications';

const SORT_OPTIONS: Array<{ value: NotificationSort; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'unread_first', label: 'Unread first' },
];

function label(v: string): string {
  return v.charAt(0) + v.slice(1).toLowerCase();
}

export default function NotificationFilters({
  filters,
  setFilters,
  categoryCounts,
}: {
  filters: NotificationFilterState;
  setFilters: React.Dispatch<React.SetStateAction<NotificationFilterState>>;
  categoryCounts: Record<string, number>;
}) {
  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--mr-dash-hair)' }}>
      <input
        className="dash-input"
        type="search"
        value={filters.q}
        onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        placeholder="Search notifications…"
        aria-label="Search notifications"
        style={{ width: '100%', marginBottom: 10 }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {NOTIFICATION_CATEGORIES.map((c) => {
          const active = filters.categories.includes(c);
          const unread = categoryCounts[c] ?? 0;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              className={active ? 'dash-btn-primary' : 'dash-btn-secondary'}
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() =>
                setFilters((f) => ({ ...f, categories: toggle(f.categories, c as NotificationCategory) }))
              }
            >
              {label(c)}
              {unread > 0 && (
                <span style={{ marginLeft: 6, opacity: 0.75 }}>{unread}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <label className="dash-sr-only" htmlFor="notif-severity">Severity</label>
        <select
          id="notif-severity"
          className="dash-select"
          aria-label="Severity"
          value={filters.severities[0] ?? ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              severities: e.target.value ? [e.target.value as NotificationSeverity] : [],
            }))
          }
          style={{ fontSize: 12, padding: '3px 6px' }}
        >
          <option value="">Any importance</option>
          {NOTIFICATION_SEVERITIES.map((s) => (
            <option key={s} value={s}>{label(s)}</option>
          ))}
        </select>

        <label className="dash-sr-only" htmlFor="notif-sort">Sort</label>
        <select
          id="notif-sort"
          className="dash-select"
          aria-label="Sort"
          value={filters.sort}
          onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as NotificationSort }))}
          style={{ fontSize: 12, padding: '3px 6px' }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mr-fg-3)' }}>
          <input
            type="checkbox"
            checked={filters.unreadOnly}
            onChange={(e) => setFilters((f) => ({ ...f, unreadOnly: e.target.checked }))}
          />
          Unread only
        </label>
      </div>
    </div>
  );
}
