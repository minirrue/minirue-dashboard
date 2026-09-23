'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown, Download, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { FILTER_DEFS, activeFilterCount, filterLabel, type FilterKey, type Filters } from '@/lib/analytics/visitors';
import { matchPreset, presetRange, RANGE_PRESETS, type AnalyticsRangeState, type RangePreset } from '@/lib/analytics/range';
import { fmtInt, rangeLabel } from '@/lib/analytics/format';

/**
 * Animate UI: Popover / Dropdown Menu. One open at a time; Esc, Tab or a
 * click outside closes it and focus goes back to its trigger; arrow keys
 * move through the options.
 */
function Menu({
  label,
  button,
  open,
  setOpen,
  align,
  children,
}: {
  label: string;
  button: (props: { 'aria-expanded': boolean; 'aria-haspopup': 'menu'; onClick: () => void; ref: React.Ref<HTMLButtonElement> }) => React.ReactNode;
  open: boolean;
  setOpen: (v: boolean) => void;
  align?: 'end';
  children: React.ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const first = pop.current?.querySelector<HTMLElement>('[aria-checked="true"], [role^="menuitem"], input');
    first?.focus();
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, setOpen]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(pop.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (!items.length) return;
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div className="anx-popwrap" ref={wrap} onKeyDown={onKey}>
      {button({ 'aria-expanded': open, 'aria-haspopup': 'menu', onClick: () => setOpen(!open), ref: trigger })}
      {open ? (
        <div className="anx-pop" role="menu" aria-label={label} ref={pop} data-align={align}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface ToolbarProps {
  range: AnalyticsRangeState;
  onRange: (r: { from: string; to: string }) => void;
  filters: Filters;
  options: Record<FilterKey, { value: string; label: string; count: number }[]>;
  onFilter: (key: FilterKey, value: string) => void;
  onOpenFilterSheet: () => void;
  whoLabel: string;
  whoTone: 'ok' | 'warn';
  onWho: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onExport: () => void;
}

export default function Toolbar(p: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [custom, setCustom] = useState({ from: p.range.from, to: p.range.to });
  const preset = matchPreset(p.range);
  const count = activeFilterCount(p.filters);
  const setter = (id: string) => (v: boolean) => setOpenMenu(v ? id : null);

  const pickPreset = (id: RangePreset) => {
    p.onRange(presetRange(id));
    setOpenMenu(null);
  };

  return (
    <div className="anx-toolbar" role="toolbar" aria-label="Analytics filters and actions">
      <Menu
        label="Date range"
        open={openMenu === 'range'}
        setOpen={(v) => {
          if (v) setCustom({ from: p.range.from, to: p.range.to });
          setter('range')(v);
        }}
        button={(b) => (
          <button type="button" className="anx-btn" {...b}>
            <Calendar className="anx-i" aria-hidden />
            <span>{rangeLabel(p.range.from, p.range.to)}</span>
            <ChevronDown className="anx-i-sm" aria-hidden />
          </button>
        )}
      >
        <h4>Date range</h4>
        {RANGE_PRESETS.map((r) => (
          <button key={r.id} type="button" className="anx-opt" role="menuitemradio" aria-checked={preset === r.id} onClick={() => pickPreset(r.id)}>
            {r.label}
            <span className="anx-opt-n">{rangeLabel(presetRange(r.id).from, presetRange(r.id).to)}</span>
          </button>
        ))}
        <div className="anx-pop-sep" />
        <h4>Custom range</h4>
        <form
          className="anx-custom"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.from && custom.to && custom.from <= custom.to) {
              p.onRange(custom);
              setOpenMenu(null);
            }
          }}
        >
          <label>
            From
            <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          </label>
          <label>
            To
            <input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </label>
          <button type="submit" className="anx-btn" disabled={!custom.from || !custom.to || custom.from > custom.to}>
            Apply dates
          </button>
        </form>
      </Menu>

      <div className="anx-tb-group">
        {FILTER_DEFS.map((d) => {
          const sel = p.filters[d.key];
          const value = sel.length === 0 ? 'All' : sel.length === 1 ? filterLabel(d.key, sel[0]) : `${sel.length} selected`;
          return (
            <Menu
              key={d.key}
              label={d.label}
              open={openMenu === d.key}
              setOpen={setter(d.key)}
              button={(b) => (
                <button type="button" className="anx-btn" data-has={sel.length > 0 || undefined} {...b}>
                  {d.label}
                  <span className="anx-val">{value}</span>
                  <ChevronDown className="anx-i-sm" aria-hidden />
                </button>
              )}
            >
              <h4>{d.label}</h4>
              {p.options[d.key].length ? (
                p.options[d.key].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className="anx-opt"
                    role="menuitemcheckbox"
                    aria-checked={sel.includes(o.value)}
                    onClick={() => p.onFilter(d.key, o.value)}
                  >
                    <span className="anx-box">
                      <Check aria-hidden />
                    </span>
                    {o.label}
                    <span className="anx-opt-n anx-num">{fmtInt(o.count)}</span>
                  </button>
                ))
              ) : (
                <p className="anx-p" style={{ padding: 8 }}>
                  Nothing to filter by in this range.
                </p>
              )}
            </Menu>
          );
        })}
      </div>
      <button type="button" className="anx-btn anx-filters-mobile" aria-haspopup="dialog" onClick={p.onOpenFilterSheet}>
        <SlidersHorizontal className="anx-i" aria-hidden />
        Filters
        {count ? <span className="anx-val">({count})</span> : null}
      </button>

      <span className="anx-tb-spacer" />

      <button type="button" className="anx-pill" data-tone={p.whoTone} aria-haspopup="dialog" onClick={p.onWho} title={`${p.whoLabel}. Open Who counts`}>
        <ShieldCheck className="anx-i" aria-hidden />
        <span className="anx-pill-long">{p.whoLabel}</span>
        <span className="anx-sr">This is us: who counts in these numbers</span>
      </button>
      <button type="button" className="anx-btn anx-btn-icon" aria-label="Refresh data" onClick={p.onRefresh} disabled={p.refreshing} data-busy={p.refreshing || undefined}>
        <RefreshCw className="anx-i" aria-hidden />
      </button>
      <button type="button" className="anx-btn anx-btn-primary" aria-haspopup="dialog" onClick={p.onExport}>
        <Download className="anx-i" aria-hidden />
        Export
      </button>
    </div>
  );
}
