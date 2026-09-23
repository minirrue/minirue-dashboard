'use client';

import React, { useState } from 'react';
import Sheet from '@/components/dashboard/ui/Sheet';
import { FILTER_DEFS, emptyFilters, type FilterKey, type Filters } from '@/lib/analytics/visitors';
import { fmtInt } from '@/lib/analytics/format';

/** Phones: every filter in one sheet, applied together. */
export default function FilterSheet({
  filters,
  options,
  onApply,
  onClose,
}: {
  filters: Filters;
  options: Record<FilterKey, { value: string; label: string; count: number }[]>;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Filters>(() => ({ ...filters }));
  const toggle = (k: FilterKey, v: string, on: boolean) =>
    setDraft((d) => ({ ...d, [k]: on ? [...d[k], v] : d[k].filter((x) => x !== v) }));
  return (
    <Sheet
      scopeClassName="anx"
      size="narrow"
      labelId="anx-filters-title"
      title="Filters"
      subtitle="Apply to every section"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="anx-btn" onClick={() => setDraft(emptyFilters())}>
            Clear all
          </button>
          <button type="button" className="anx-btn anx-btn-primary" onClick={() => onApply(draft)}>
            Show results
          </button>
        </>
      }
    >
      {FILTER_DEFS.map((d) => (
        <fieldset key={d.key}>
          <legend>{d.label}</legend>
          {options[d.key].length ? (
            options[d.key].map((o) => (
              <label key={o.value} className="anx-choice">
                <input type="checkbox" checked={draft[d.key].includes(o.value)} onChange={(e) => toggle(d.key, o.value, e.target.checked)} />
                <span>
                  <b>{o.label}</b>
                  <small>{fmtInt(o.count)} visitors</small>
                </span>
              </label>
            ))
          ) : (
            <p className="anx-p">Nothing to filter by in this range.</p>
          )}
        </fieldset>
      ))}
    </Sheet>
  );
}
