'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatEgpMinor } from '@/components/dashboard/charts';
import {
  apiAddCompetitorPrice,
  apiDeleteCompetitorPrice,
  apiUpdateProductKnowledge,
  apiUpdateVariantPricing,
  type CostCurrency,
  type PriceFlag,
  type PriceKnowledge,
  type PriceTrace,
  type PricingMode,
  type RepriceResponse,
  type VariantPricingInput,
  type VariantRow,
} from '@/lib/api/accounting';
import { formatAmount, parseAmountInput } from '@/lib/accounting/validate';

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

/** Short names for the engine's flags, as the Prices tab lists them. */
export const FLAG_LABELS: Record<PriceFlag, string> = {
  CANT_COMPETE: "Can't compete",
  THIN_MARGIN: 'Thin margin',
  NO_MARKET: 'No market price',
  NO_COST: 'No cost',
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
  if (row.cost.amountMinor === null) return undefined;
  if (row.cost.currency === 'USD') return `USD ${formatAmount(row.cost.amountMinor)}, at today’s rate`;
  return row.cost.followsUsd ? 'EGP that follows the dollar' : 'Fixed EGP';
}

/** A stored amount as the text a field starts with: 65000 → "650", 87550 → "875.5". */
function toInput(minor: number | null): string {
  return minor === null ? '' : formatAmount(minor).replace(/,/g, '');
}

function reason(err: unknown): string {
  const message = (err as { message?: unknown } | null)?.message;
  if (typeof message !== 'string' || message.trim() === '') return 'Check your connection and try again.';
  const text = message.trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function changedLine(count: number): string {
  if (count === 0) return 'Saved. No price changed.';
  return `Saved. ${count} ${count === 1 ? 'price' : 'prices'} changed.`;
}

type Section = 'cost' | 'knowledge' | 'market' | 'mode';
type Status = { section: Section; tone: 'ok' | 'error'; text: string };

/** The save result for one section: a polite status on success, an alert on failure. */
function SectionStatus({ status, section }: { status: Status | null; section: Section }) {
  if (!status || status.section !== section) return null;
  return status.tone === 'ok' ? (
    <p className="acct-pd-status" role="status">
      {status.text}
    </p>
  ) : (
    <p className="acct-pd-status" role="alert" data-tone="error">
      {status.text}
    </p>
  );
}

function Choice({
  name,
  value,
  checked,
  title,
  hint,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  title: string;
  hint: ReactNode;
  onChange: () => void;
}) {
  return (
    <label className="acct-pd-choice">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span>
        <strong>{title}</strong>
        <span>{hint}</span>
      </span>
    </label>
  );
}

export interface PricingDrawerProps {
  row: VariantRow;
  /** Box & trip per order, from the overview's fees. */
  fulfillmentMinor: number;
  onClose: () => void;
  /** Refetches the overview after a save; rejects when that refetch fails. */
  onSaved: () => Promise<void>;
}

/**
 * Everything behind one price, in the order a shop owner reasons about it.
 * Every edit calls its item route (backend#160), which reprices live; the tab
 * then refetches the overview so the row and this drawer show the stored result.
 */
export default function PricingDrawer({ row, fulfillmentMinor, onClose, onSaved }: PricingDrawerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [saving, setSaving] = useState<Section | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  const [costInput, setCostInput] = useState(toInput(row.cost.amountMinor));
  const [currency, setCurrency] = useState<CostCurrency>(row.cost.currency ?? 'EGP');
  const [followsUsd, setFollowsUsd] = useState(row.cost.followsUsd);
  const [knowledge, setKnowledge] = useState<PriceKnowledge>(row.priceKnowledge ?? 'KNOWN_BRAND');
  const [source, setSource] = useState('');
  const [marketInput, setMarketInput] = useState('');
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<PricingMode>(row.mode);
  const [myPriceInput, setMyPriceInput] = useState(toInput(row.currentPriceMinor));

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const system = row.system;
  const floors = system.floors;
  const trace = system.trace.length > 0 ? system.trace : [{ step: 'FLAG', valueMinor: null, note: 'NO_COST' }];
  const why = whyFromTrace(trace);
  const busy = saving !== null;

  const fail = (section: Section, text: string) => setStatus({ section, tone: 'error', text });

  /** One write at a time: send it, refetch the overview, report the run. */
  async function save(section: Section, send: () => Promise<RepriceResponse>, after?: () => void) {
    if (busy) return;
    setSaving(section);
    setStatus(null);
    let res: RepriceResponse;
    try {
      res = await send();
    } catch (err) {
      setSaving(null);
      fail(section, `Could not save: ${reason(err)} Nothing changed.`);
      return;
    }
    after?.();
    try {
      await onSaved();
      setStatus({ section, tone: 'ok', text: changedLine(res.run.changedCount) });
    } catch {
      fail(section, `${changedLine(res.run.changedCount)} The list could not refresh; reload the page to see it.`);
    }
    setSaving(null);
  }

  function saveCost() {
    const amount = costInput.trim() === '' ? null : parseAmountInput(costInput);
    if (costInput.trim() !== '' && (amount === null || amount > 2_147_483_647)) {
      fail('cost', 'Enter the cost as a number, like 650 or 650.50.');
      return;
    }
    const costFields = { costCurrency: currency, followsUsd: currency === 'EGP' && followsUsd };
    let body: VariantPricingInput;
    if (row.mode === 'SYSTEM') {
      if (amount === null) {
        fail('cost', 'Enter the cost. A System price needs one.');
        return;
      }
      body = { mode: 'SYSTEM', costAmountMinor: amount, ...costFields };
    } else {
      body =
        amount === null
          ? { mode: 'MANUAL', manualPriceMinor: row.currentPriceMinor, costAmountMinor: null }
          : { mode: 'MANUAL', manualPriceMinor: row.currentPriceMinor, costAmountMinor: amount, ...costFields };
    }
    void save('cost', () => apiUpdateVariantPricing(row.variantId, body));
  }

  function saveKnowledge(next: PriceKnowledge) {
    if (busy || next === knowledge) return;
    const previous = knowledge;
    setKnowledge(next);
    void save('knowledge', () =>
      apiUpdateProductKnowledge(row.productId, next).catch((err) => {
        setKnowledge(previous);
        throw err;
      }),
    );
  }

  function addCompetitor(e: FormEvent) {
    e.preventDefault();
    const name = source.trim();
    const price = parseAmountInput(marketInput);
    const link = url.trim();
    if (name === '') return fail('market', 'Name the shop, like Noon or Amazon.');
    if (name.length > 80) return fail('market', 'Keep the shop name to 80 characters.');
    if (price === null || price < 1) return fail('market', 'Enter their price as a number, like 850.');
    if (link !== '' && !/^https?:\/\/\S+$/i.test(link)) {
      return fail('market', 'Enter the link as a full address starting with https://, or leave it empty.');
    }
    void save(
      'market',
      () => apiAddCompetitorPrice(row.variantId, { source: name, priceMinor: price, ...(link ? { url: link } : {}) }),
      () => {
        setSource('');
        setMarketInput('');
        setUrl('');
      },
    );
  }

  function saveMode() {
    if (mode === 'SYSTEM') {
      if (row.cost.amountMinor === null) {
        fail('mode', 'Enter a cost first. A System price is worked out from it.');
        return;
      }
      // The stored currency and dollar link go too: omitted, the backend would read them as fixed EGP.
      const body: VariantPricingInput = {
        mode: 'SYSTEM',
        costAmountMinor: row.cost.amountMinor,
        costCurrency: row.cost.currency ?? 'EGP',
        followsUsd: row.cost.followsUsd,
      };
      void save('mode', () => apiUpdateVariantPricing(row.variantId, body));
      return;
    }
    const price = parseAmountInput(myPriceInput);
    if (price === null || price < 1) {
      fail('mode', 'Enter your price as a number above 0, like 799.');
      return;
    }
    void save('mode', () => apiUpdateVariantPricing(row.variantId, { mode: 'MANUAL', manualPriceMinor: price }));
  }

  const knowledgeName = `${titleId}-knowledge`;
  const modeName = `${titleId}-mode`;

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
        aria-busy={busy}
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
              {row.productName}{' '}
              <span className="acct-pd-subtitle">
                {row.sku}
                {!row.isActive && ' · Inactive'}
              </span>
            </h2>
            <p className="acct-pd-price">
              <span className="mr-num">{formatEgpMinor(row.currentPriceMinor)}</span>
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
          <section className="acct-pd-section" aria-labelledby={`${titleId}-cost`}>
            <h3 id={`${titleId}-cost`}>What it cost you</h3>
            <p className="acct-pd-lede">One unit today, rounded up to the piastre, and the two floors it sets.</p>
            <dl className="acct-pd-figures">
              <Figure
                label="Cost"
                value={row.costMinor === null ? 'No cost yet' : formatEgpMinor(row.costMinor)}
                note={costNote(row)}
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
            <form
              className="acct-pd-edit"
              onSubmit={(e) => {
                e.preventDefault();
                saveCost();
              }}
            >
              <label className="acct-pd-field acct-pd-field-amount">
                <span>Cost per unit</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="dash-input mr-num"
                  value={costInput}
                  placeholder={row.mode === 'MANUAL' ? 'Unknown' : undefined}
                  onChange={(e) => setCostInput(e.target.value)}
                />
              </label>
              <label className="acct-pd-field acct-pd-field-currency">
                <span>Currency</span>
                <select
                  className="dash-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CostCurrency)}
                >
                  <option value="EGP">EGP</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              {currency === 'EGP' && (
                <label className="acct-pd-check">
                  <input type="checkbox" checked={followsUsd} onChange={(e) => setFollowsUsd(e.target.checked)} />
                  <span>Follows the dollar</span>
                </label>
              )}
              <button type="submit" className="dash-btn-secondary acct-pd-save" disabled={busy}>
                {saving === 'cost' ? 'Saving…' : 'Save cost'}
              </button>
            </form>
            <SectionStatus status={status} section="cost" />
          </section>

          <section className="acct-pd-section" aria-labelledby={`${titleId}-know`}>
            <h3 id={`${titleId}-know`}>What customers know</h3>
            <p className="acct-pd-lede">
              How easily shoppers can compare this price decides how high it may go. It applies to every size of{' '}
              {row.productName}, and saves as you choose.
            </p>
            <fieldset className="acct-pd-choices" disabled={busy}>
              <legend className="acct-pd-sr">What customers know</legend>
              {(Object.keys(KNOWLEDGE) as PriceKnowledge[]).map((k) => (
                <Choice
                  key={k}
                  name={knowledgeName}
                  value={k}
                  checked={knowledge === k}
                  title={KNOWLEDGE[k].label}
                  hint={KNOWLEDGE[k].hint}
                  onChange={() => saveKnowledge(k)}
                />
              ))}
            </fieldset>
            {row.priceKnowledge === null && (
              <p className="acct-pd-note">Not chosen yet, so it is read as “{KNOWLEDGE.KNOWN_BRAND.label}”.</p>
            )}
            <SectionStatus status={status} section="knowledge" />
          </section>

          <section className="acct-pd-section" aria-labelledby={`${titleId}-market`}>
            <h3 id={`${titleId}-market`}>Competitor prices</h3>
            <p className="acct-pd-lede">The market is the middle of the prices you enter, so one odd price cannot drag it.</p>
            {row.competitorPrices.length > 0 ? (
              <ul className="acct-pd-competitors">
                {row.competitorPrices.map((c) => (
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
                    <span className="acct-pd-competitor-end">
                      <span className="mr-num">{formatEgpMinor(c.priceMinor)}</span>
                      <button
                        type="button"
                        className="dash-btn-ghost acct-pd-remove"
                        aria-label={`Remove the ${c.source} price`}
                        disabled={busy}
                        onClick={() => void save('market', () => apiDeleteCompetitorPrice(c.id))}
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
                {system.marketMinor !== null && (
                  <li className="acct-pd-market">
                    <span>Market</span>
                    <span className="mr-num">{formatEgpMinor(system.marketMinor)}</span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="acct-pd-empty">No competitor prices yet. Add one below to set the market.</p>
            )}
            <form className="acct-pd-edit acct-pd-add" onSubmit={addCompetitor} noValidate>
              <label className="acct-pd-field">
                <span>Shop</span>
                <input
                  type="text"
                  autoComplete="off"
                  className="dash-input"
                  value={source}
                  maxLength={80}
                  onChange={(e) => setSource(e.target.value)}
                />
              </label>
              <label className="acct-pd-field acct-pd-field-amount">
                <span>Their price (EGP)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="dash-input mr-num"
                  value={marketInput}
                  onChange={(e) => setMarketInput(e.target.value)}
                />
              </label>
              <label className="acct-pd-field acct-pd-field-wide">
                <span>Link (optional)</span>
                <input
                  type="url"
                  autoComplete="off"
                  className="dash-input"
                  value={url}
                  placeholder="https://"
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
              <button type="submit" className="dash-btn-secondary acct-pd-save" disabled={busy}>
                {saving === 'market' ? 'Saving…' : 'Add price'}
              </button>
            </form>
            <SectionStatus status={status} section="market" />
          </section>

          <section className="acct-pd-section" aria-labelledby={`${titleId}-why`}>
            <h3 id={`${titleId}-why`}>How this price was set</h3>
            <p className="acct-pd-lede">Worked out step by step from the numbers above.</p>
            <p className="acct-pd-why">{why}</p>
            {row.mode === 'MANUAL' && system.priceMinor !== null && system.priceMinor !== row.currentPriceMinor && (
              <p className="acct-pd-compare">
                You chose <span className="mr-num">{formatEgpMinor(row.currentPriceMinor)}</span>. The System price
                would be <span className="mr-num">{formatEgpMinor(system.priceMinor)}</span>.
              </p>
            )}
          </section>

          <section className="acct-pd-section" aria-labelledby={`${titleId}-mode`}>
            <h3 id={`${titleId}-mode`}>Mode</h3>
            <p className="acct-pd-lede">Who sets this price: the system, or you.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMode();
              }}
            >
              <fieldset className="acct-pd-choices" disabled={busy}>
                <legend className="acct-pd-sr">Mode</legend>
                {(Object.keys(MODE) as PricingMode[]).map((m) => (
                  <Choice
                    key={m}
                    name={modeName}
                    value={m}
                    checked={mode === m}
                    title={MODE[m].label}
                    hint={MODE[m].hint}
                    onChange={() => setMode(m)}
                  />
                ))}
                {mode === 'MANUAL' && (
                  <label className="acct-pd-field acct-pd-field-amount">
                    <span>My price (EGP)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="dash-input mr-num"
                      value={myPriceInput}
                      onChange={(e) => setMyPriceInput(e.target.value)}
                    />
                  </label>
                )}
                <div className="acct-pd-actions">
                  <button type="submit" className="dash-btn-secondary acct-pd-save">
                    {saving === 'mode' ? 'Saving…' : 'Save mode'}
                  </button>
                </div>
              </fieldset>
            </form>
            <SectionStatus status={status} section="mode" />
          </section>
        </div>
      </aside>
    </>,
    document.body,
  );
}
