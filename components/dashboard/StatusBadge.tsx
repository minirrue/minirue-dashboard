import React from 'react';

export type StatusKind = 'draft' | 'published' | 'archived';

export interface StatusBadgeProps {
  status: StatusKind;
  /** Override label text. Defaults to capitalized status. */
  label?: string;
}

const LABELS: Record<StatusKind, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className="dash-status" data-status={status}>
      <span className="dash-status-dot" />
      {label ?? LABELS[status]}
    </span>
  );
}
