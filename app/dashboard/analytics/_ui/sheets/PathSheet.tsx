'use client';

import React from 'react';
import Sheet from '@/components/dashboard/ui/Sheet';
import type { PathRow } from '@/lib/analytics/model';
import { cairoDateTime, fmtInt } from '@/lib/analytics/format';
import { personViews } from '@/lib/analytics/model';
import { useShell } from '../context';

/** One flow path, and every person on it. */
export default function PathSheet({ row, onClose }: { row: PathRow; onClose: () => void }) {
  const { openVisitor } = useShell();
  const people = personViews(row.people).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  const beforeProduct = row.visited - row.product;
  const beforeBag = row.product - row.bag;
  const biggest =
    beforeProduct >= beforeBag
      ? `${fmtInt(beforeProduct)} left before viewing a product`
      : `${fmtInt(beforeBag)} viewed a product but didn’t add it`;
  return (
    <Sheet
      scopeClassName="anx"
      size="narrow"
      labelId="anx-path-title"
      title="Path detail"
      subtitle={`${fmtInt(row.visited)} ${row.visited === 1 ? 'person' : 'people'}`}
      onClose={onClose}
      footer={
        <button type="button" className="anx-btn" data-autofocus onClick={onClose}>
          Close
        </button>
      }
    >
      <dl className="anx-preview">
        <div>
          <dt>Path</dt>
          <dd>
            {row.source} → {row.landing}
          </dd>
        </div>
        <div>
          <dt>People</dt>
          <dd>
            {fmtInt(row.visited)} visited · {fmtInt(row.product)} viewed a product · {fmtInt(row.bag)} added · {fmtInt(row.checkout)} checkout ·{' '}
            {fmtInt(row.purchased)} bought
          </dd>
        </div>
        <div>
          <dt>Biggest loss</dt>
          <dd>{biggest}</dd>
        </div>
      </dl>
      <div>
        <span className="anx-legend-title">People on this path</span>
        <div className="anx-list">
          {people.map((p) => (
            <div className="anx-li" key={p.id}>
              <button type="button" className="anx-link anx-li-t" onClick={() => openVisitor(p.id)}>
                {p.label}
              </button>
              <span className="anx-small">{cairoDateTime(p.lastSeenAt)}</span>
              <div className="anx-li-s">
                <span>
                  {p.place} · {p.device}
                </span>
                <span>· {p.outcomeLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
