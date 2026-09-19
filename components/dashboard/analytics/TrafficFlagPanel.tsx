'use client';

import React, { useCallback, useState } from 'react';
import { ReasonPicker, type ReasonOption } from '@/components/dashboard/ReasonPicker';
import {
  apiRevokeTrafficFlag,
  apiSetTrafficFlag,
  apiTrafficFlagFor,
  TRAFFIC_CLASS_COPY,
  type FlagSubjectType,
  type TrafficClass,
  type TrafficFlag,
} from '@/lib/api/traffic-flags';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

type Choice = 'COUNTS' | TrafficClass;

const CHOICES_BY_SUBJECT: Record<FlagSubjectType, Choice[]> = {
  // An account is almost always "ours" or a real customer; bots rarely sign in.
  USER: ['COUNTS', 'OWNER', 'INTERNAL', 'SUSPICIOUS', 'TRUSTED'],
  VISITOR: ['COUNTS', 'OWNER', 'INTERNAL', 'BOT', 'SUSPICIOUS', 'TRUSTED'],
};

function options(subject: FlagSubjectType): ReasonOption<Choice>[] {
  return CHOICES_BY_SUBJECT[subject].map((value) =>
    value === 'COUNTS'
      ? { value, label: 'Counts normally', description: 'The automatic filters decide, as for every shopper.' }
      : { value, label: TRAFFIC_CLASS_COPY[value].label, description: TRAFFIC_CLASS_COPY[value].consequence },
  );
}

function day(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "412 events · 3 orders since 2 Sep" — what the verdict actually changed. */
export function affectedLine(flag: TrafficFlag): string {
  const parts: string[] = [];
  const { events, orders, visitors, fromDay } = flag.affected;
  parts.push(`${events.toLocaleString()} ${events === 1 ? 'event' : 'events'}`);
  if (orders > 0) parts.push(`${orders} ${orders === 1 ? 'order' : 'orders'}`);
  if (visitors > 1) parts.push(`${visitors} devices`);
  return `${parts.join(' · ')}${fromDay ? ` since ${day(fromDay)}` : ''}`;
}

/**
 * Who counts in analytics, decided on the record it belongs to (dashboard#111).
 * Lives on the customer page (the account and every device it used) and on a
 * visitor's page (that one device). One verdict at a time; applying rewrites
 * history, so the panel says what it will do before it does it.
 */
export default function TrafficFlagPanel({
  subjectType,
  subjectId,
  onChange,
}: {
  subjectType: FlagSubjectType;
  subjectId: string;
  onChange?: (flag: TrafficFlag | null) => void;
}) {
  const [flag, setFlag] = useState<TrafficFlag | null | undefined>(undefined);
  const [choice, setChoice] = useState<Choice>('COUNTS');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { flag: active } = await apiTrafficFlagFor(subjectType, subjectId);
      setFlag(active);
      setChoice(active?.trafficClass ?? 'COUNTS');
      setNote(active?.reason ?? '');
    } catch {
      setFlag(null);
    }
  }, [subjectType, subjectId]);

  useMountedEffect(() => { void load(); }, [load]);

  const current: Choice = flag?.trafficClass ?? 'COUNTS';
  const dirty = choice !== current || (choice !== 'COUNTS' && (note.trim() || null) !== (flag?.reason ?? null));
  const needsNote = choice === 'SUSPICIOUS' && !note.trim();

  async function apply() {
    setSaving(true);
    setError(null);
    try {
      let next: TrafficFlag | null;
      if (choice === 'COUNTS') {
        if (flag) await apiRevokeTrafficFlag(flag.id);
        next = null;
      } else {
        next = await apiSetTrafficFlag({ subjectType, subjectId, trafficClass: choice, reason: note.trim() || null });
      }
      setFlag(next);
      setEditing(false);
      onChange?.(next);
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (flag === undefined) {
    return (
      <section className="dash-form-section dash-flag-panel" aria-busy="true">
        <span className="dash-skeleton" style={{ display: 'block', width: '40%', height: 14 }} />
      </section>
    );
  }

  const cls = flag?.trafficClass;
  return (
    <section className="dash-form-section dash-flag-panel" data-class={cls ?? 'COUNTS'} aria-labelledby={`flag-${subjectId}`}>
      <header className="dash-flag-panel__head">
        <div>
          <h2 id={`flag-${subjectId}`} className="dash-section-title dash-flag-panel__title">Analytics</h2>
          <p className="dash-flag-panel__status">
            {cls ? (
              <>
                <span className="dash-flag-chip" data-class={cls}>{TRAFFIC_CLASS_COPY[cls].short}</span>
                <span>{cls === 'TRUSTED' ? 'Counted, overriding the bot filters' : 'Excluded from every count'}</span>
              </>
            ) : (
              <span>Counts normally</span>
            )}
          </p>
        </div>
        {!editing && (
          <button type="button" className="dash-btn-secondary" onClick={() => { setEditing(true); setError(null); }}>
            {cls ? 'Change' : 'Exclude or verify'}
          </button>
        )}
      </header>

      {flag && !editing && (
        <p className="dash-flag-panel__meta">
          {affectedLine(flag)}
          {flag.reason ? <> · “{flag.reason}”</> : null}
          <> · set {new Date(flag.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
        </p>
      )}

      {editing && (
        <div className="dash-flag-panel__form">
          <ReasonPicker<Choice>
            label={subjectType === 'USER' ? 'This account, on every device it used' : 'This device'}
            options={options(subjectType)}
            value={choice}
            onChange={setChoice}
            note={note}
            onNoteChange={setNote}
            otherValue="SUSPICIOUS"
            showOptionalNote={choice !== 'COUNTS'}
            noteLabel="Reason"
            notePlaceholder="e.g. my own phone, QA test orders"
            disabled={saving}
          />
          {choice !== current && choice !== 'COUNTS' && choice !== 'TRUSTED' && (
            <p className="dash-help-text dash-flag-panel__warn">
              Past visits and orders are corrected too. The analytics screens catch up within a few minutes.
            </p>
          )}
          {error && <p className="dash-inline-error" role="alert">{error}</p>}
          <div className="dash-form-actions">
            <button
              type="button"
              className="dash-btn-primary"
              disabled={!dirty || needsNote || saving}
              onClick={() => void apply()}
            >
              {saving ? 'Saving…' : choice === 'COUNTS' && flag ? 'Count again' : 'Apply'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              disabled={saving}
              onClick={() => { setEditing(false); setChoice(current); setNote(flag?.reason ?? ''); setError(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
