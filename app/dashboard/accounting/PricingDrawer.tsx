'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatEgpMinor } from '@/components/dashboard/charts';
import type {
  PriceKnowledge,
  PriceTrace,
  PricingMode,
  SetRow,
  VariantRow,
  Warning,
} from '@/lib/api/accounting';

/** One row of the Prices tab: a house variant or a set. */
export type PriceRow = { kind: 'variant'; row: VariantRow } | { kind: 'set'; row: SetRow };

/** A money figure with a real minus sign, so a loss never reads as "EGP -48.50". */
export function formatSignedEgp(minor: number): string {
  return minor < 0 ? `−${formatEgpMinor(-minor)}` : formatEgpMinor(minor);
}

export const KNOWLEDGE: Record<PriceKnowledge, { label: string; hint: string }> = {
  KNOWN_PRICE: {
    label: 'Customers know the exact price',
    hint: 'They can find this exact item elsewhere, so the price stays at or under the market.',
  },
  KNOWN_BRAND: {
    label: 'Customers know the brand',
    hint: 'They know roughly what the brand costs, so the price may sit a little above the market.',
  },
  UNCOMPARABLE: {
    label: "Customers can't compare",
    hint: 'Nobody sells anything close, so the price follows your margin rules instead.',
  },
};

export const MODE: Record<PricingMode, { label: string; hint: string }> = {
  SYSTEM: {
    label: 'System price',
    hint: 'Follows your cost, the market and the strategy, and updates itself when they change.',
  },
  MANUAL: {
    label: 'My price',
    hint: 'You set it yourself. Nothing changes it, and you are warned when it is too low.',
  },
};

const FLAG_SENTENCES: Record<string, string> = {
  CANT_COMPETE: "The Law 1 floor is above what customers will pay, so it can't compete on price.",
  THIN_MARGIN: 'The margin is thin.',
  NO_MARKET: 'Customers know the exact price, but no competitor price is entered yet.',
  NO_COST: 'No cost is entered, so there is no System price and discounts on it are unprotected.',
};

/**
 * The plain-English "why", built only from the engine's trace (epic #155:
 * never written separately), so it can never disagree with the price.
 */
export function whyFromTrace(trace: PriceTrace): string {
  const at = (step: string) => {
    const hit = trace.find((t) => t.step === step);
    return hit && hit.valueMinor !== null ? { ...hit, valueMinor: hit.valueMinor } : undefined;
  };
  const m = formatEgpMinor;
  const parts: string[] = [];

  const cost = at('COST');
  const k = at('FULFILLMENT');
  const law1 = at('LAW1');
  const law1Shown = at('LAW1_SHOWN');
  if (cost && k && law1) {
    parts.push(
      `It costs you ${m(cost.valueMinor)}, plus ${m(k.valueMinor)} for the box & trip, so the Law 1 floor is ${m(law1.valueMinor)}` +
        (law1Shown ? ` (shown as ${m(law1Shown.valueMinor)}).` : '.'),
    );
  }

  const market = at('MARKET');
  if (market) parts.push(`Competitors charge ${m(market.valueMinor)} (${market.note}).`);

  const members = at('MEMBERS');
  const saving = at('SAVING');
  if (members && saving) {
    parts.push(
      `Its members add up to ${m(members.valueMinor)}, less a ${saving.note.replace(/^saving /, '')} saving.`,
    );
  }

  const lo = at('BAND_LO');
  const hi = at('BAND_HI');
  if (lo && hi) {
    parts.push(
      `The price can sit between ${m(lo.valueMinor)} (${lo.note}) and ${m(hi.valueMinor)} (${hi.note}).`,
    );
  }

  const target = at('TARGET');
  const price = at('PRICE');
  if (target && price) {
    const lead = /of the way$/.test(target.note)
      ? `The strategy puts it ${target.note}, at`
      : 'That comes to';
    parts.push(`${lead} ${m(target.valueMinor)}, ${price.note}: ${m(price.valueMinor)}.`);
  }

  for (const flag of trace.filter((t) => t.step === 'FLAG')) {
    parts.push(FLAG_SENTENCES[flag.note] ?? flag.note);
  }
  return parts.join(' ');
}

function AvailableSoon() {
  return <span className="acct-building-status">Available soon</span>;
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="acct-pd-figure">
      <dt>{label}</dt>
      <dd>
        <span className="mr-num">{value}</span>
        {note && <span className="acct-pd-figure-note">{note}</span>}
      </dd>
    </div>
  );
}

function costNote(row: VariantRow): string | undefined {
  if (row.costAmountMinor === null) return undefined;
  if (row.costCurrency === 'USD') return 'Entered in USD, at today’s rate';
  return row.followsUsd ? 'EGP that follows the dollar' : 'Fixed EGP';
}

function WarningList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="acct-pd-warnings" aria-label="Warnings">
      {warnings.map((w) => (
        <li key={w.key}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            <strong>{w.title}</strong>
            {w.detail && <> · {w.detail}</>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface PricingDrawerProps {
  item: PriceRow;
  /** Box & trip per order, from the settings. */
  fulfillmentMinor: number;
  onClose: () => void;
}

/**
 * Everything behind one price, in the order a shop owner reasons about it.
 * Edits call the BE-5 routes once they exist; until then every input is shown
 * disabled with "Available soon" rather than pretending to save.
 */
export default function PricingDrawer({ item, fulfillmentMinor, onClose }: PricingDrawerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const { row } = item;
  const result = row.result;
  const variant = item.kind === 'variant' ? item.row : null;
  const title = variant ? variant.productName : item.kind === 'set' ? item.row.bundleName : '';
  const subtitle = variant
    ? [variant.variantLabel, variant.sku].filter(Boolean).join(' · ')
    : 'Set';
  const trace = result?.trace ?? [{ step: 'FLAG', valueMinor: null, note: 'NO_COST' }];
  const why = whyFromTrace(trace);
  const costMinor = trace.find((t) => t.step === 'COST')?.valueMinor ?? variant?.costAmountMinor ?? null;
  const floors = result?.floors ?? null;
  const systemPrice = result?.priceMinor ?? null;

  // Portalled to <body>: the dashboard's content column is a containing block
  // for position: fixed, which clipped the drawer inside the Prices card.
  // Only ever mounted after a click, so `document` exists.
  return createPortal(
    <>
      <div className="acct-pd-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="acct-pd"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="acct-pd-head">
          <div className="acct-pd-head-text">
            <h2 id={titleId} className="acct-pd-title">
              {title}{' '}
              <span className="acct-pd-subtitle">{subtitle}</span>
            </h2>
            <p className="acct-pd-price">
              <span className="mr-num">{formatEgpMinor(row.livePriceMinor)}</span>
              <span className="acct-pd-mode">{MODE[row.mode].label}</span>
            </p>
          </div>
          <button ref={closeRef} type="button" className="acct-pd-close" onClick={onClose} aria-label="Close">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </header>

        <div className="acct-pd-body">
          <WarningList warnings={row.warnings} />

          <section className="acct-pd-section" aria-labelledby={`${titleId}-cost`}>
            <h3 id={`${titleId}-cost`}>What it cost you</h3>
            <p className="acct-pd-lede">One unit today, rounded up to the piastre, and the two floors it sets.</p>
            <dl className="acct-pd-figures">
              <Figure
                label="Cost"
                value={costMinor === null ? 'No cost yet' : formatEgpMinor(costMinor)}
                note={variant ? costNote(variant) : 'The members’ costs added up'}
              />
              <Figure label="Box & trip" value={formatEgpMinor(fulfillmentMinor)} note="Per order" />
              <Figure
                label="Law 1 floor"
                value={floors ? formatEgpMinor(floors.law1ShownMinor) : '—'}
                note="System prices never go below it"
              />
              <Figure
                label="No-loss floor"
                value={floors ? formatEgpMinor(floors.noLossShownMinor) : '—'}
                note="Discounts stop here"
              />
            </dl>
            {variant && (
              <div className="acct-pd-edit">
                <label className="acct-pd-field">
                  <span>Cost per unit (EGP)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="dash-input mr-num"
                    defaultValue={variant.costAmountMinor === null ? '' : String(variant.costAmountMinor / 100)}
                    disabled
                  />
                </label>
                <AvailableSoon />
              </div>
            )}
          </section>

          <section className="acct-pd-section" aria-labelledby={`${titleId}-know`}>
            <h3 id={`${titleId}-know`}>What customers know</h3>
            <p className="acct-pd-lede">How easily shoppers can compare this price decides how high it may go.</p>
            {variant ? (
              <fieldset className="acct-pd-choices" disabled>
                <legend className="acct-pd-sr">What customers know</legend>
                {(Object.keys(KNOWLEDGE) as PriceKnowledge[]).map((k) => (
                  <label key={k} className="acct-pd-choice">
                    <input type="radio" name={`${titleId}-knowledge`} value={k} defaultChecked={variant.knowledge === k} />
                    <span>
                      <strong>{KNOWLEDGE[k].label}</strong>
                      <span>{KNOWLEDGE[k].hint}</span>
                    </span>
                  </label>
                ))}
                <AvailableSoon />
              </fieldset>
            ) : (
              <p className="acct-pd-empty">A set is priced from its members, so this does not apply.</p>
            )}
          </section>

          <section className="acct-pd-section" aria-labelledby={`${titleId}-market`}>
            <h3 id={`${titleId}-market`}>Competitor prices</h3>
            <p className="acct-pd-lede">The market is the middle of the prices you enter, so one odd price cannot drag it.</p>
            {variant && variant.competitorPrices.length > 0 ? (
              <ul className="acct-pd-competitors">
                {variant.competitorPrices.map((c) => (
                  <li key={c.id}>
                    <span className="acct-pd-competitor-source">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noreferrer" className="dash-link">
                          {c.source}
                        </a>
                      ) : (
                        c.source
                      )}
                      <span className="acct-pd-figure-note">
                        Checked {new Date(c.checkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </span>
                    <span className="mr-num">{formatEgpMinor(c.priceMinor)}</span>
                  </li>
                ))}
                {result?.marketMinor != null && (
                  <li className="acct-pd-market">
                    <span>Market</span>
                    <span className="mr-num">{formatEgpMinor(result.marketMinor)}</span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="acct-pd-empty">
                {variant ? 'No competitor prices yet.' : 'Sets are not compared with the market.'}
              </p>
            )}
            {variant && (
              <div className="acct-pd-edit">
                <label className="acct-pd-field">
                  <span>Add a competitor price (EGP)</span>
                  <input type="text" inputMode="decimal" className="dash-input mr-num" disabled />
                </label>
                <AvailableSoon />
              </div>
            )}
          </section>

          <section className="acct-pd-section" aria-labelledby={`${titleId}-why`}>
            <h3 id={`${titleId}-why`}>How this price was set</h3>
            <p className="acct-pd-lede">Worked out step by step from the numbers above.</p>
            <p className="acct-pd-why">{why}</p>
            {row.mode === 'MANUAL' && systemPrice !== null && systemPrice !== row.livePriceMinor && (
              <p className="acct-pd-compare">
                You chose <span className="mr-num">{formatEgpMinor(row.livePriceMinor)}</span>. The System price
                would be <span className="mr-num">{formatEgpMinor(systemPrice)}</span>.
              </p>
            )}
          </section>

          <section className="acct-pd-section" aria-labelledby={`${titleId}-mode`}>
            <h3 id={`${titleId}-mode`}>Mode</h3>
            <p className="acct-pd-lede">Who sets this price: the system, or you.</p>
            <fieldset className="acct-pd-choices" disabled>
              <legend className="acct-pd-sr">Mode</legend>
              {(Object.keys(MODE) as PricingMode[]).map((mode) => (
                <label key={mode} className="acct-pd-choice">
                  <input type="radio" name={`${titleId}-mode`} value={mode} defaultChecked={row.mode === mode} />
                  <span>
                    <strong>{MODE[mode].label}</strong>
                    <span>{MODE[mode].hint}</span>
                  </span>
                </label>
              ))}
              <label className="acct-pd-field">
                <span>My price (EGP)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="dash-input mr-num"
                  defaultValue={String(row.livePriceMinor / 100)}
                />
              </label>
              <AvailableSoon />
            </fieldset>
          </section>
        </div>
      </aside>
    </>,
    document.body,
  );
}
