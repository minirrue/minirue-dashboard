/**
 * The dashboard-level export (dashboard#128): one entry point, the current
 * section, chosen sections or the whole dashboard, as CSV or JSON, generated
 * in the browser from the very same view model the screen renders, so the
 * file and the screen cannot disagree.
 *
 * Replaces the per-block Export menus and the per-table CSV buttons (Command
 * Center, Visitors, Sources, Open carts), which each built their own rows.
 */

export type ExportFormat = 'csv' | 'json';
export type ExportCell = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportCell>;

export interface ExportColumn {
  key: string;
  label: string;
}

export interface ExportTable {
  title: string;
  /** How to read it: "Unique people", "Events, not people". */
  note?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
}

export interface ExportSection {
  id: string;
  title: string;
  /** The plain-language answer line shown at the top of the section. */
  answer?: string;
  tables: ExportTable[];
}

export interface ExportContext {
  from: string;
  to: string;
  rangeLabel: string;
  filters: string;
  whoCounts: string;
  /** Cairo 12-hour stamp, e.g. "22 Sep 2026, 1:45 PM". */
  generatedAt: string;
}

function csvCell(v: ExportCell): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Leading =,+,-,@ would be run as a formula by Excel: neutralise it.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const BOM = '﻿';

/** A flat CSV of rows (headers = the union of keys, in first-seen order). */
export function toCsv(rows: ExportRow[]): string {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','));
  // BOM so Excel reads UTF-8 (Arabic names, the EGP sign) correctly.
  return BOM + lines.join('\r\n');
}

/**
 * One CSV that keeps the dashboard's structure: the context block first,
 * then each section with its answer and every table under its own title,
 * header row and all of its rows. Opens as one sheet in Excel or Sheets.
 */
export function buildCsvDocument(ctx: ExportContext, sections: ExportSection[]): string {
  const lines: string[] = [];
  const row = (...cells: ExportCell[]) => lines.push(cells.map(csvCell).join(','));
  row('MiniRue analytics export');
  row('Date range', ctx.rangeLabel, `${ctx.from} to ${ctx.to}`);
  row('Filters', ctx.filters);
  row('Who counts', ctx.whoCounts);
  row('Sections', sections.map((s) => s.title).join(', '));
  row('Generated', `${ctx.generatedAt} (Cairo time)`);
  for (const s of sections) {
    lines.push('');
    row(`Section: ${s.title}`);
    if (s.answer) row('Answer', s.answer);
    for (const t of s.tables) {
      lines.push('');
      row(t.title);
      if (t.note) row(t.note);
      row(...t.columns.map((c) => c.label));
      for (const r of t.rows) row(...t.columns.map((c) => r[c.key]));
      if (!t.rows.length) row('No rows for this range and these filters.');
    }
  }
  return BOM + lines.join('\r\n');
}

/** The same content as structured JSON, for AI tools and scripts. */
export function buildJsonDocument(ctx: ExportContext, sections: ExportSection[]): string {
  return JSON.stringify(
    {
      exportedFrom: 'MiniRue dashboard · Analytics',
      range: { from: ctx.from, to: ctx.to, label: ctx.rangeLabel },
      filters: ctx.filters,
      whoCounts: ctx.whoCounts,
      sections: sections.map((s) => s.title),
      generatedAt: `${ctx.generatedAt} (Cairo time)`,
      data: sections.map((s) => ({
        id: s.id,
        title: s.title,
        answer: s.answer ?? null,
        tables: s.tables.map((t) => ({
          title: t.title,
          note: t.note ?? null,
          columns: t.columns.map((c) => c.label),
          rows: t.rows.map((r) => Object.fromEntries(t.columns.map((c) => [c.label, r[c.key] ?? null]))),
        })),
      })),
    },
    null,
    2,
  );
}

/** "minirue-analytics_overview_2026-08-23_2026-09-21.csv". */
export function exportFileName(slug: string, format: ExportFormat, range?: { from: string; to: string }): string {
  const clean = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
  return `minirue-analytics_${clean}${range ? `_${range.from}_${range.to}` : ''}.${format}`;
}

/** Hands the browser a file. */
export function downloadFile(filename: string, body: string, format: ExportFormat): void {
  const blob = new Blob([body], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
