'use client';

import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, Download, AlertTriangle } from 'lucide-react';
import Sheet from '@/components/dashboard/ui/Sheet';
import { SECTIONS, type SectionId } from '@/lib/analytics/model';
import { buildCsvDocument, buildJsonDocument, downloadFile, exportFileName, type ExportFormat } from '@/lib/analytics/export';
import { sectionExport, type ExportExtras } from '@/lib/analytics/export-sections';
import { cairoStamp } from '@/lib/analytics/format';
import { downloadServerExport } from '@/lib/api/story';
import { useShell } from '../context';
import { ToggleGroup } from '../parts';

type Scope = 'current' | 'selected' | 'all';

/**
 * The one Export for the whole dashboard (dashboard#128): the current
 * section, chosen sections or everything, as CSV or JSON, built in the
 * browser from the same model and view state the screen shows. Raw events
 * are a separately named option, built by the server.
 */
export default function ExportSheet({
  section,
  onClose,
  rangeLabel,
  filtersLabel,
  whoCounts,
  extras,
}: {
  section: SectionId;
  onClose: () => void;
  rangeLabel: string;
  filtersLabel: string;
  whoCounts: string;
  extras: ExportExtras;
}) {
  const { model, view, range, toast } = useShell();
  const [scope, setScope] = useState<Scope>('current');
  const [picked, setPicked] = useState<Set<SectionId>>(() => new Set([section]));
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [advanced, setAdvanced] = useState(false);
  const [raw, setRaw] = useState(false);
  const [status, setStatus] = useState<{ state: 'idle' } | { state: 'working' } | { state: 'ready'; files: string[]; stamp: string; rawFailed: boolean }>({ state: 'idle' });

  const ids: SectionId[] = scope === 'current' ? [section] : scope === 'all' ? SECTIONS.map((s) => s.id) : SECTIONS.map((s) => s.id).filter((id) => picked.has(id));
  const names = ids.map((id) => SECTIONS.find((s) => s.id === id)!.label);
  const slug = scope === 'current' ? section : scope === 'all' ? 'dashboard' : 'sections';
  const file = exportFileName(slug, format, range);
  const current = SECTIONS.find((s) => s.id === section)!.label;

  const run = async () => {
    if (!ids.length) return;
    setStatus({ state: 'working' });
    const stamp = cairoStamp(new Date());
    const ctx = { from: range.from, to: range.to, rangeLabel, filters: filtersLabel, whoCounts, generatedAt: stamp };
    const sections = ids.map((id) => sectionExport(id, model, view, extras));
    const body = format === 'csv' ? buildCsvDocument(ctx, sections) : buildJsonDocument(ctx, sections);
    downloadFile(file, body, format);
    const files = [file];
    let rawFailed = false;
    if (raw) {
      const ok = await downloadServerExport('story', format, range, {}, 'raw-events');
      if (ok) files.push(exportFileName('raw-events', format, range));
      else rawFailed = true;
    }
    setStatus({ state: 'ready', files, stamp, rawFailed });
    toast('Export ready');
  };

  return (
    <Sheet
      scopeClassName="anx"
      size="narrow"
      labelId="anx-export-title"
      title="Export"
      subtitle="Matches what’s on screen, with the same filters."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="anx-btn" onClick={onClose}>
            {status.state === 'ready' ? 'Close' : 'Cancel'}
          </button>
          <button type="button" className="anx-btn anx-btn-primary" data-autofocus disabled={!ids.length || status.state === 'working'} onClick={() => void run()}>
            <Download className="anx-i-sm" aria-hidden />
            {status.state === 'ready' ? 'Export again' : 'Export'}
          </button>
        </>
      }
    >
      <fieldset>
        <legend>What to export</legend>
        <label className="anx-choice">
          <input type="radio" name="anx-scope" checked={scope === 'current'} onChange={() => setScope('current')} />
          <span>
            <b>This section · {current}</b>
            <small>Exactly what you see, every table row included</small>
          </span>
        </label>
        <label className="anx-choice">
          <input type="radio" name="anx-scope" checked={scope === 'selected'} onChange={() => setScope('selected')} />
          <span>
            <b>Selected sections</b>
            <small>Pick the sections to include</small>
          </span>
        </label>
        <div className="anx-ah" data-open={scope === 'selected' || undefined}>
          <div inert={scope !== 'selected'}>
            <div className="anx-sub-list" aria-disabled={scope !== 'selected'}>
              {SECTIONS.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={picked.has(s.id)}
                    onChange={(e) =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      })
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <label className="anx-choice">
          <input type="radio" name="anx-scope" checked={scope === 'all'} onChange={() => setScope('all')} />
          <span>
            <b>Entire dashboard</b>
            <small>All seven sections, in order</small>
          </span>
        </label>
      </fieldset>
      <fieldset>
        <legend>Format</legend>
        <ToggleGroup
          label="File format"
          value={format}
          options={[
            { value: 'csv', label: 'CSV' },
            { value: 'json', label: 'JSON' },
          ]}
          onChange={setFormat}
        />
      </fieldset>
      <dl className="anx-preview" aria-label="Export includes">
        <div>
          <dt>Date range</dt>
          <dd>{rangeLabel}</dd>
        </div>
        <div>
          <dt>Filters</dt>
          <dd>{filtersLabel}</dd>
        </div>
        <div>
          <dt>Who counts</dt>
          <dd>{whoCounts}</dd>
        </div>
        <div>
          <dt>Sections</dt>
          <dd>{names.length ? names.join(', ') : 'None selected: tick at least one'}</dd>
        </div>
        <div>
          <dt>Generated</dt>
          <dd>{status.state === 'ready' ? `${status.stamp} (Cairo time)` : 'At export time, in Cairo time'}</dd>
        </div>
        <div>
          <dt>File</dt>
          <dd className="anx-raw anx-raw-wrap">{file}</dd>
        </div>
      </dl>
      <div>
        <button type="button" className="anx-disclose" aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)}>
          <ChevronRight aria-hidden />
          Advanced
        </button>
        <div className="anx-ah" data-open={advanced || undefined}>
          <div inert={!advanced}>
            <label className="anx-choice" style={{ marginTop: 6 }}>
              <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} />
              <span>
                <b>Raw events (event-level)</b>
                <small>Every step of every counted visitor in the range, one row each, built by the server. A separate file, not a copy of the dashboard.</small>
              </span>
            </label>
          </div>
        </div>
      </div>
      <div role="status" aria-live="polite">
        {status.state === 'working' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span>Building your export…</span>
            <div className="anx-progress">
              <i />
            </div>
          </div>
        ) : status.state === 'ready' ? (
          <div className="anx-ready" data-tone={status.rawFailed ? 'bad' : undefined}>
            {status.rawFailed ? <AlertTriangle className="anx-i" aria-hidden /> : <CheckCircle2 className="anx-i" aria-hidden />}
            <div>
              <b>{status.rawFailed ? 'Dashboard exported; raw events failed' : 'Export ready'}</b>
              <p>
                Downloaded {status.files.join(' and ')}.
                {status.rawFailed ? ' The server could not build the raw events file. Try again, or narrow the dates.' : ''}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
