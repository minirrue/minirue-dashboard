'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiAccountingOverview,
  apiUpdatePricingSettings,
  type PriceKnowledge,
  type PriceRounding,
  type PricingSettings,
} from '@/lib/api/accounting';
import { apiGetSettings, type StoreSettings } from '@/lib/api/settings';
import {
  KNOWLEDGE_CLASSES,
  LABEL_MAX,
  boxAndTripMinor,
  deliveryFeeMinor,
  formatAmount,
  newItemId,
  toDraft,
  validatePricingDraft,
  type ClassRuleDraft,
  type DraftIssue,
  type PricingDraft,
} from '@/lib/accounting/validate';
import { KNOWLEDGE } from './PricingDrawer';
import './costs-tab.css';

const ROUNDING: Record<PriceRounding, { label: string; hint: string }> = {
  END_9: {
    label: 'End prices in 9',
    hint: 'System prices go to the nearest …9, and never below Law 1. Floors are shown this way too.',
  },
  NONE: {
    label: 'Exact figures',
    hint: 'System prices stay at the computed figure, to the piastre.',
  },
};

const RULE_COLUMNS: { key: keyof ClassRuleDraft; label: string }[] = [
  { key: 'undercut', label: 'Reach end, under market' },
  { key: 'premium', label: 'Profit end, over market' },
  { key: 'noMarketMin', label: 'No competitor price, lowest margin' },
  { key: 'noMarketMax', label: 'No competitor price, highest margin' },
];

const errId = (field: string) => `acct-costs-err-${field.replace(/[^\w-]/g, '-')}`;

function errorMessage(e: unknown): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m.trim() !== '' ? m : 'the server did not accept it';
}

/** A text input with its unit drawn inside the field, and its error wired up. */
function UnitInput({
  id,
  value,
  unit,
  field,
  issues,
  label,
  onChange,
}: {
  id: string;
  value: string;
  unit: string;
  field: string;
  issues: DraftIssue[];
  label?: string;
  onChange: (next: string) => void;
}) {
  const mine = issues.filter((i) => i.field === field);
  return (
    <>
      <span className="acct-costs-unit" data-unit={unit}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={`dash-input mr-num${mine.length ? ' dash-input-error' : ''}`}
          value={value}
          aria-label={label}
          aria-invalid={mine.length > 0}
          aria-describedby={mine.length ? errId(field) : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="acct-costs-unit-text" aria-hidden="true">
          {unit}
        </span>
      </span>
      {mine.length > 0 && (
        <p className="dash-field-error" id={errId(field)}>
          {mine[0].message}
        </p>
      )}
    </>
  );
}

type Status = { tone: 'ok' | 'error'; text: string } | null;

/**
 * Costs & rules tab (minirue-dashboard#59): the box & trip line items with a
 * live per-order total, what the delivery fee leaves after them, the margin
 * guardrails, the rules for each kind of product and the rounding choice.
 * Save sends the whole `pricing` block, which reprices System prices live.
 */
export default function CostsTab() {
  const [base, setBase] = useState<PricingSettings | null>(null);
  const [draft, setDraft] = useState<PricingDraft | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [shipping, setShipping] = useState<StoreSettings['shipping'] | null | 'error'>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const load = useCallback(() => {
    let cancelled = false;
    apiAccountingOverview()
      .then((o) => {
        if (cancelled) return;
        setBase(o.pricing);
        setDraft(toDraft(o.pricing));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    apiGetSettings()
      .then((s) => {
        if (!cancelled) setShipping(s.shipping ?? 'error');
      })
      .catch(() => {
        if (!cancelled) setShipping('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const result = useMemo(
    () => (draft && base ? validatePricingDraft(draft, base) : null),
    [draft, base],
  );
  const dirty = useMemo(
    () => !!draft && !!base && JSON.stringify(draft) !== JSON.stringify(toDraft(base)),
    [draft, base],
  );

  if (loadError) {
    return (
      <section className="dash-card acct-costs-state" role="alert">
        <p>Could not load your costs and rules. Check your connection and try again.</p>
        <button
          type="button"
          className="dash-btn-secondary"
          onClick={() => {
            setLoadError(false);
            load();
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  if (!draft || !base || !result) {
    return (
      <section className="dash-card acct-costs-loading" aria-busy="true" aria-label="Loading costs and rules">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className="dash-skeleton acct-costs-skeleton" />
        ))}
      </section>
    );
  }

  const { issues } = result;
  const total = boxAndTripMinor(draft.items);
  const ship = shipping === null || shipping === 'error' ? null : shipping;
  const fee = deliveryFeeMinor(ship);
  const freeDelivery = (ship?.freeOverCents ?? 0) > 0;

  const update = (change: Partial<PricingDraft>) => {
    setDraft((d) => (d ? { ...d, ...change } : d));
    setStatus(null);
  };
  const updateItem = (id: string, change: { label?: string; amountInput?: string }) =>
    update({ items: draft.items.map((i) => (i.id === id ? { ...i, ...change } : i)) });
  const updateRule = (k: PriceKnowledge, key: keyof ClassRuleDraft, value: string) =>
    update({ classes: { ...draft.classes, [k]: { ...draft.classes[k], [key]: value } } });
  const issueFor = (field: string) => issues.find((i) => i.field === field);

  const save = async () => {
    if (!result.settings) {
      setStatus({ tone: 'error', text: 'Fix the fields marked in red. Nothing was saved.' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await apiUpdatePricingSettings(result.settings);
      setBase(res.overview.pricing);
      setDraft(toDraft(res.overview.pricing));
      const n = res.run.changedCount;
      setStatus({
        tone: 'ok',
        text: `Saved. ${n === 0 ? 'No prices changed' : `${n} ${n === 1 ? 'price' : 'prices'} changed`}.`,
      });
    } catch (e) {
      setStatus({ tone: 'error', text: `Could not save: ${errorMessage(e)}. Nothing changed.` });
    } finally {
      setSaving(false);
    }
  };

  let feeLine: ReactNode;
  if (shipping === null) {
    feeLine = <span className="acct-costs-muted">Reading your delivery fee…</span>;
  } else if (fee === null) {
    feeLine = <span className="acct-costs-muted">Could not read the delivery fee from Settings.</span>;
  } else if (!total.complete) {
    feeLine = <span className="acct-costs-muted">Fill in every amount to see what each order keeps.</span>;
  } else {
    const keep = fee - total.totalMinor;
    feeLine = (
      <>
        Customers pay <strong className="mr-num">{formatAmount(fee)}</strong>
        {' · '}
        {keep >= 0 ? (
          <>
            you keep <strong className="mr-num" data-tone="ok">{formatAmount(keep)}</strong> per order
          </>
        ) : (
          <>
            you pay <strong className="mr-num" data-tone="danger">{formatAmount(-keep)}</strong> more than that
            per order
          </>
        )}
      </>
    );
  }

  return (
    <div className="acct-costs">
      <section className="dash-form-card acct-costs-card" aria-labelledby="acct-costs-kt">
        <header className="acct-costs-head">
          <div>
            <h2 id="acct-costs-kt" className="dash-section-title">
              Box &amp; trip
            </h2>
            <p className="acct-costs-lede">
              What sending one order costs you, whatever is inside. It counts once per order, in EGP.
            </p>
          </div>
          <p className="acct-costs-total" aria-live="polite">
            <span className="mr-num">{formatAmount(total.totalMinor)}</span> per order
            {!total.complete && <span className="acct-costs-total-note">so far</span>}
          </p>
        </header>

        {draft.items.length === 0 ? (
          <p className="acct-costs-empty">
            No costs listed, so every order counts as costing you nothing to send. Add the box, packaging
            and trip.
          </p>
        ) : (
          <ul className="acct-costs-items">
            {draft.items.map((item, index) => {
              const labelIssue = issueFor(`items.${item.id}.label`);
              const name = item.label.trim() || `cost ${index + 1}`;
              return (
                <li key={item.id} className="acct-costs-item">
                  <div className="dash-field acct-costs-item-name">
                    <label className="dash-label" htmlFor={`acct-cost-${item.id}-label`}>
                      Cost
                    </label>
                    <input
                      id={`acct-cost-${item.id}-label`}
                      type="text"
                      autoComplete="off"
                      maxLength={LABEL_MAX + 10}
                      className={`dash-input${labelIssue ? ' dash-input-error' : ''}`}
                      value={item.label}
                      placeholder="e.g. Tissue paper"
                      aria-invalid={!!labelIssue}
                      aria-describedby={labelIssue ? errId(`items.${item.id}.label`) : undefined}
                      onChange={(e) => updateItem(item.id, { label: e.target.value })}
                    />
                    {labelIssue && (
                      <p className="dash-field-error" id={errId(`items.${item.id}.label`)}>
                        {labelIssue.message}
                      </p>
                    )}
                  </div>
                  <div className="dash-field acct-costs-item-amount">
                    <label className="dash-label" htmlFor={`acct-cost-${item.id}-amount`}>
                      Amount
                    </label>
                    <UnitInput
                      id={`acct-cost-${item.id}-amount`}
                      value={item.amountInput}
                      unit="EGP"
                      field={`items.${item.id}.amount`}
                      issues={issues}
                      onChange={(v) => updateItem(item.id, { amountInput: v })}
                    />
                  </div>
                  <button
                    type="button"
                    className="dash-btn-ghost acct-costs-remove"
                    aria-label={`Remove ${name}`}
                    onClick={() => update({ items: draft.items.filter((i) => i.id !== item.id) })}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div>
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() =>
              update({
                items: [
                  ...draft.items,
                  { id: newItemId(draft.items.map((i) => i.id)), label: '', amountInput: '' },
                ],
              })
            }
          >
            Add a cost
          </button>
        </div>

        <div className="acct-costs-fee" aria-live="polite">
          <p className="acct-costs-fee-line">{feeLine}</p>
          <p className="acct-costs-fee-hint">
            {freeDelivery
              ? 'Free delivery is on in Settings, so the engine counts the delivery fee as 0 and discounts get no cushion.'
              : 'This is the lowest delivery fee any order pays, from Settings. Discounts may spend what you keep, never more.'}
          </p>
        </div>
      </section>

      <section className="dash-form-card acct-costs-card" aria-labelledby="acct-costs-guard">
        <header>
          <h2 id="acct-costs-guard" className="dash-section-title">
            Margin guardrails
          </h2>
          <p className="acct-costs-lede">The limits every System price keeps to, whatever the market does.</p>
        </header>
        <div className="acct-costs-guards">
          <div className="dash-field">
            <label className="dash-label" htmlFor="acct-guard-min">
              Lowest margin
            </label>
            <UnitInput
              id="acct-guard-min"
              value={draft.minMargin}
              unit="%"
              field="guardrails.min"
              issues={issues}
              onChange={(v) => update({ minMargin: v })}
            />
            <p className="dash-help-text">
              Prices are lifted to at least this when there is room. Below it you get a Thin margin warning.
            </p>
          </div>
          <div className="dash-field">
            <label className="dash-label" htmlFor="acct-guard-max">
              Highest margin
            </label>
            <UnitInput
              id="acct-guard-max"
              value={draft.maxMargin}
              unit="%"
              field="guardrails.max"
              issues={issues}
              onChange={(v) => update({ maxMargin: v })}
            />
            <p className="dash-help-text">No System price goes above this, even when competitors charge more.</p>
          </div>
        </div>
      </section>

      <section className="dash-form-card acct-costs-card" aria-labelledby="acct-costs-classes">
        <header>
          <h2 id="acct-costs-classes" className="dash-section-title">
            Rules by what customers know
          </h2>
          <p className="acct-costs-lede">
            How far a price may sit from the market. The slider moves each price between its reach end and its
            profit end.
          </p>
        </header>
        <div className="acct-costs-rules-wrap">
          <table className="acct-costs-rules">
            <thead>
              <tr>
                <th scope="col">What customers know</th>
                <th scope="col">
                  Reach end
                  <span>under market</span>
                </th>
                <th scope="col">
                  Profit end
                  <span>over market</span>
                </th>
                <th scope="col" colSpan={2}>
                  No competitor price
                  <span>margin from, to</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {KNOWLEDGE_CLASSES.map((k) => (
                <tr key={k}>
                  <th scope="row">
                    {KNOWLEDGE[k].label}
                    {k === 'KNOWN_BRAND' && <span className="acct-costs-default">Default</span>}
                  </th>
                  {RULE_COLUMNS.map((col) => (
                    <td key={col.key} data-label={col.label}>
                      <UnitInput
                        id={`acct-rule-${k}-${col.key}`}
                        value={draft.classes[k][col.key]}
                        unit="%"
                        field={`classes.${k}.${col.key}`}
                        issues={issues}
                        label={`${KNOWLEDGE[k].label}: ${col.label}`}
                        onChange={(v) => updateRule(k, col.key, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dash-form-card acct-costs-card" aria-labelledby="acct-costs-rounding">
        <header>
          <h2 id="acct-costs-rounding" className="dash-section-title">
            Rounding
          </h2>
          <p className="acct-costs-lede">How the last digits of a System price are set.</p>
        </header>
        <fieldset className="acct-costs-choices">
          <legend className="acct-costs-sr">Rounding</legend>
          {(Object.keys(ROUNDING) as PriceRounding[]).map((r) => (
            <label key={r} className="acct-costs-choice">
              <input
                type="radio"
                name="acct-rounding"
                value={r}
                checked={draft.rounding === r}
                onChange={() => update({ rounding: r })}
              />
              <span>
                <strong>{ROUNDING[r].label}</strong>
                <span>{ROUNDING[r].hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <div className="acct-costs-savebar" data-dirty={dirty || undefined}>
        <p
          className="acct-costs-status"
          role={status?.tone === 'error' ? 'alert' : 'status'}
          data-tone={status?.tone}
        >
          {status
            ? status.text
            : issues.length > 0
              ? `${issues.length} ${issues.length === 1 ? 'field needs' : 'fields need'} fixing before you can save.`
              : dirty
                ? 'Unsaved changes. Saving reprices every System price at once.'
                : 'Everything is saved.'}
        </p>
        <div className="acct-costs-actions">
          <button
            type="button"
            className="dash-btn-ghost"
            disabled={!dirty || saving}
            onClick={() => {
              setDraft(toDraft(base));
              setStatus(null);
            }}
          >
            Discard
          </button>
          <button type="button" className="dash-btn-primary" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
