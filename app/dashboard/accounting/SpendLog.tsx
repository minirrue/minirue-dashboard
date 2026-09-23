'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  apiCreateSpend,
  apiDeleteSpend,
  apiListSpend,
  apiUpdateSpend,
  type SpendChannel,
  type SpendEntry,
  type SpendInput,
} from '@/lib/api/accounting';
import { formatAmount, parseAmountInput } from '@/lib/accounting/validate';
import { UTM_CAMPAIGN_MAX } from '@/lib/analytics/ad-link';

export const SPEND_CHANNELS: { id: SpendChannel; label: string }[] = [
  { id: 'META', label: 'Meta (Facebook, Instagram)' },
  { id: 'TIKTOK', label: 'TikTok' },
  { id: 'GOOGLE', label: 'Google & YouTube' },
  { id: 'INFLUENCER', label: 'Influencer' },
  { id: 'OFFLINE', label: 'Offline' },
  { id: 'OTHER', label: 'Other' },
];

const CAMPAIGN_MAX = 80;
const CODE_MAX = 32;
const NOTE_MAX = 2000;

interface SpendDraft {
  channel: SpendChannel;
  campaign: string;
  amount: string;
  spentFrom: string;
  spentTo: string;
  utmCampaign: string;
  discountCode: string;
  note: string;
}

type DraftField = keyof SpendDraft;

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyDraft(): SpendDraft {
  const t = today();
  return {
    channel: 'META',
    campaign: '',
    amount: '',
    spentFrom: t,
    spentTo: t,
    utmCampaign: '',
    discountCode: '',
    note: '',
  };
}

function toDraft(e: SpendEntry): SpendDraft {
  return {
    channel: e.channel,
    campaign: e.campaign,
    amount: formatAmount(e.amountMinor).replace(/,/g, ''),
    spentFrom: e.spentFrom,
    spentTo: e.spentTo,
    utmCampaign: e.utmCampaign ?? '',
    discountCode: e.discountCode ?? '',
    note: e.note ?? '',
  };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const orNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** Mirrors the backend `CreateSpendSchema` (backend#165), so a 422 is rare. */
export function validateSpendDraft(d: SpendDraft): {
  errors: Partial<Record<DraftField, string>>;
  input: SpendInput | null;
} {
  const errors: Partial<Record<DraftField, string>> = {};
  const campaign = d.campaign.trim();
  if (!campaign) errors.campaign = 'Name the campaign.';
  else if (campaign.length > CAMPAIGN_MAX) errors.campaign = `Keep the name to ${CAMPAIGN_MAX} characters.`;
  const amountMinor = parseAmountInput(d.amount);
  if (amountMinor === null || amountMinor <= 0) errors.amount = 'Enter what you spent, e.g. 1500 or 1500.50.';
  if (!ISO_DAY.test(d.spentFrom)) errors.spentFrom = 'Pick the first day.';
  if (!ISO_DAY.test(d.spentTo)) errors.spentTo = 'Pick the last day.';
  else if (!errors.spentFrom && d.spentTo < d.spentFrom) errors.spentTo = 'The last day is before the first.';
  if (d.utmCampaign.trim().length > UTM_CAMPAIGN_MAX) {
    errors.utmCampaign = `Keep it to ${UTM_CAMPAIGN_MAX} characters.`;
  }
  if (d.discountCode.trim().length > CODE_MAX) errors.discountCode = `Keep it to ${CODE_MAX} characters.`;
  if (d.note.trim().length > NOTE_MAX) errors.note = `Keep the note to ${NOTE_MAX} characters.`;
  if (Object.keys(errors).length > 0 || amountMinor === null) return { errors, input: null };
  return {
    errors,
    input: {
      channel: d.channel,
      campaign,
      amountMinor,
      spentFrom: d.spentFrom,
      spentTo: d.spentTo,
      utmCampaign: orNull(d.utmCampaign),
      discountCode: orNull(d.discountCode),
      note: orNull(d.note),
    },
  };
}

/** Only the fields that differ from the stored row, for `PATCH spend/:id`. */
export function spendPatch(before: SpendEntry, input: SpendInput): Partial<SpendInput> {
  const patch: Partial<SpendInput> = {};
  const keys: (keyof SpendInput)[] = [
    'channel',
    'campaign',
    'amountMinor',
    'spentFrom',
    'spentTo',
    'utmCampaign',
    'discountCode',
    'note',
  ];
  for (const k of keys) {
    if ((input[k] ?? null) !== (before[k] ?? null)) Object.assign(patch, { [k]: input[k] });
  }
  return patch;
}

function errorMessage(e: unknown): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m.trim() !== '' ? m : 'the server did not accept it';
}

const channelLabel = (c: SpendChannel) => SPEND_CHANNELS.find((x) => x.id === c)?.label ?? c;

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function dayRange(from: string, to: string): string {
  return from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;
}

type Status = { tone: 'ok' | 'error'; text: string } | null;

function Field({
  id,
  label,
  error,
  hint,
  children,
  wide,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`dash-field${wide ? ' acct-spend-wide' : ''}`}>
      <label className="dash-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="dash-field-error" id={`${id}-err`}>
          {error}
        </p>
      ) : hint ? (
        <p className="dash-help-text">{hint}</p>
      ) : null}
    </div>
  );
}

function SpendForm({
  initial,
  editing,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: SpendDraft;
  editing: boolean;
  busy: boolean;
  onSubmit: (input: SpendInput) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [shown, setShown] = useState(false);
  const { errors, input } = validateSpendDraft(draft);
  const err = (f: DraftField) => (shown ? errors[f] : undefined);
  const set = (change: Partial<SpendDraft>) => setDraft((d) => ({ ...d, ...change }));
  const inputProps = (f: DraftField) => ({
    id: `acct-spend-${f}`,
    className: `dash-input${err(f) ? ' dash-input-error' : ''}`,
    'aria-invalid': !!err(f),
    'aria-describedby': err(f) ? `acct-spend-${f}-err` : undefined,
  });

  return (
    <form
      className="acct-spend-form"
      aria-label={editing ? 'Edit spend' : 'Log spend'}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setShown(true);
        if (input) onSubmit(input);
      }}
    >
      <div className="acct-spend-grid">
        <Field id="acct-spend-channel" label="Channel">
          <select
            id="acct-spend-channel"
            className="dash-select"
            value={draft.channel}
            onChange={(e) => set({ channel: e.target.value as SpendChannel })}
          >
            {SPEND_CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="acct-spend-campaign" label="Campaign" error={err('campaign')}>
          <input
            {...inputProps('campaign')}
            type="text"
            autoComplete="off"
            placeholder="e.g. Eid lip oil reels"
            value={draft.campaign}
            onChange={(e) => set({ campaign: e.target.value })}
          />
        </Field>
        <Field id="acct-spend-amount" label="Amount spent (EGP)" error={err('amount')}>
          <input
            {...inputProps('amount')}
            className={`dash-input mr-num acct-spend-amount${err('amount') ? ' dash-input-error' : ''}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft.amount}
            onChange={(e) => set({ amount: e.target.value })}
          />
        </Field>
        <Field id="acct-spend-spentFrom" label="First day" error={err('spentFrom')}>
          <input
            {...inputProps('spentFrom')}
            type="date"
            value={draft.spentFrom}
            onChange={(e) => set({ spentFrom: e.target.value })}
          />
        </Field>
        <Field id="acct-spend-spentTo" label="Last day" error={err('spentTo')}>
          <input
            {...inputProps('spentTo')}
            type="date"
            value={draft.spentTo}
            onChange={(e) => set({ spentTo: e.target.value })}
          />
        </Field>
        <Field
          id="acct-spend-utmCampaign"
          label="utm_campaign (optional)"
          error={err('utmCampaign')}
          hint="Orders from links tagged with this campaign count toward this spend."
        >
          <input
            {...inputProps('utmCampaign')}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={draft.utmCampaign}
            onChange={(e) => set({ utmCampaign: e.target.value })}
          />
        </Field>
        <Field
          id="acct-spend-discountCode"
          label="Discount code (optional)"
          error={err('discountCode')}
          hint="Orders using this code count toward this spend."
        >
          <input
            {...inputProps('discountCode')}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={draft.discountCode}
            onChange={(e) => set({ discountCode: e.target.value })}
          />
        </Field>
        <Field id="acct-spend-note" label="Note (optional)" error={err('note')} wide>
          <textarea
            {...inputProps('note')}
            className={`dash-textarea${err('note') ? ' dash-input-error' : ''}`}
            rows={2}
            value={draft.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </Field>
      </div>
      <div className="acct-spend-form-actions">
        <button type="button" className="dash-btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="dash-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save spend' : 'Add spend'}
        </button>
      </div>
    </form>
  );
}

/**
 * Spend log (minirue-dashboard#64): what was spent on ads, per channel and
 * campaign, over a date range. Growth prorates each row over the days it
 * overlaps the period. `onChange` gets the rows after every load and write.
 */
export default function SpendLog({
  onChange,
}: {
  onChange?: (entries: SpendEntry[], written: boolean) => void;
}) {
  const [entries, setEntries] = useState<SpendEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<{ kind: 'add' } | { kind: 'edit'; entry: SpendEntry } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  // The parent's callback may change identity each render; loading must not follow it.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const load = useCallback(async (written: boolean) => {
    try {
      const rows = await apiListSpend();
      setEntries(rows);
      setLoadError(false);
      onChangeRef.current?.(rows, written);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiListSpend()
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        onChangeRef.current?.(rows, false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (write: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setStatus(null);
    try {
      await write();
      setMode(null);
      setConfirming(null);
      setStatus({ tone: 'ok', text: done });
      await load(true);
    } catch (e) {
      setStatus({ tone: 'error', text: `Could not save: ${errorMessage(e)}. Nothing changed.` });
    } finally {
      setBusy(false);
    }
  };

  const submit = (input: SpendInput) => {
    if (mode?.kind === 'edit') {
      const patch = spendPatch(mode.entry, input);
      if (Object.keys(patch).length === 0) {
        setMode(null);
        setStatus({ tone: 'ok', text: 'Nothing changed.' });
        return;
      }
      void run(() => apiUpdateSpend(mode.entry.id, patch), 'Spend saved. Growth is updated.');
    } else {
      void run(() => apiCreateSpend(input), 'Spend added. Growth is updated.');
    }
  };

  return (
    <section className="dash-form-card acct-growth-card" aria-labelledby="acct-spend-title">
      <header className="acct-growth-head">
        <div>
          <h2 id="acct-spend-title" className="dash-section-title">
            Spend log
          </h2>
          <p className="acct-growth-lede">
            Every ad payment, with the days it ran. A payment that runs past the period counts only for its
            days inside it.
          </p>
        </div>
        {mode === null && (
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => {
              setMode({ kind: 'add' });
              setConfirming(null);
              setStatus(null);
            }}
          >
            Log spend
          </button>
        )}
      </header>

      {mode?.kind === 'add' && (
        <SpendForm
          initial={emptyDraft()}
          editing={false}
          busy={busy}
          onSubmit={submit}
          onCancel={() => setMode(null)}
        />
      )}

      <p
        className="acct-growth-status"
        role={status?.tone === 'error' ? 'alert' : 'status'}
        data-tone={status?.tone}
      >
        {status?.text}
      </p>

      {loadError ? (
        <div className="acct-growth-state" role="alert">
          <p>Could not load the spend log.</p>
          <button type="button" className="dash-btn-secondary" onClick={() => void load(false)}>
            Try again
          </button>
        </div>
      ) : entries === null ? (
        <span className="dash-skeleton acct-growth-skeleton" aria-label="Loading the spend log" />
      ) : entries.length === 0 ? (
        <p className="acct-growth-empty">
          Nothing logged yet. Without spend, every channel&apos;s cost per new customer stays blank.
        </p>
      ) : (
        <ul className="acct-spend-list">
          {entries.map((e) => (
            <li key={e.id} className="acct-spend-row">
              {mode?.kind === 'edit' && mode.entry.id === e.id ? (
                <SpendForm
                  initial={toDraft(e)}
                  editing
                  busy={busy}
                  onSubmit={submit}
                  onCancel={() => setMode(null)}
                />
              ) : (
                <>
                  <div className="acct-spend-main">
                    <strong>{e.campaign}</strong>
                    <span className="acct-spend-meta">
                      {channelLabel(e.channel)} · {dayRange(e.spentFrom, e.spentTo)}
                    </span>
                    {(e.utmCampaign || e.discountCode) && (
                      <span className="acct-spend-tags">
                        {e.utmCampaign && <code>utm_campaign={e.utmCampaign}</code>}
                        {e.discountCode && <code>code {e.discountCode}</code>}
                      </span>
                    )}
                    {e.note && <span className="acct-spend-note">{e.note}</span>}
                  </div>
                  <span className="acct-spend-amount-text mr-num">EGP {formatAmount(e.amountMinor)}</span>
                  {confirming === e.id ? (
                    <div className="acct-spend-actions" role="group" aria-label={`Delete ${e.campaign}?`}>
                      <span className="acct-spend-confirm">Delete this spend?</span>
                      <button
                        type="button"
                        className="dash-btn-ghost"
                        disabled={busy}
                        onClick={() => setConfirming(null)}
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        className="dash-btn-danger"
                        disabled={busy}
                        onClick={() => void run(() => apiDeleteSpend(e.id), 'Spend deleted. Growth is updated.')}
                      >
                        {busy ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <div className="acct-spend-actions">
                      <button
                        type="button"
                        className="dash-btn-ghost"
                        aria-label={`Edit ${e.campaign}`}
                        disabled={busy || mode !== null}
                        onClick={() => {
                          setMode({ kind: 'edit', entry: e });
                          setConfirming(null);
                          setStatus(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="dash-btn-ghost"
                        aria-label={`Delete ${e.campaign}`}
                        disabled={busy || mode !== null}
                        onClick={() => {
                          setConfirming(e.id);
                          setStatus(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
