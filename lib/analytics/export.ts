/**
 * Export on everything (owner, 2026-09-19: "export to each and everything").
 * Every block in Analytics & Media hands its visible rows here; the owner
 * gets exactly what is on screen, as CSV (opens in Excel/Sheets) or JSON
 * (for AI tools).
 */

export type ExportFormat = 'csv' | 'json';
export type ExportRow = Record<string, string | number | boolean | null | undefined>;

function csvCell(v: ExportRow[string]): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Leading =,+,-,@ would be run as a formula by Excel — neutralise it.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: ExportRow[]): string {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','));
  // BOM so Excel reads UTF-8 (Arabic names, the EGP sign) correctly.
  return '﻿' + lines.join('\r\n');
}

export function exportFileName(name: string, format: ExportFormat, range?: { from: string; to: string }): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
  return `minirue-${slug}${range ? `-${range.from}_${range.to}` : ''}.${format}`;
}

export function downloadRows(name: string, rows: ExportRow[], format: ExportFormat, range?: { from: string; to: string }): void {
  const body = format === 'csv' ? toCsv(rows) : JSON.stringify(rows, null, 2);
  const blob = new Blob([body], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(name, format, range);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
