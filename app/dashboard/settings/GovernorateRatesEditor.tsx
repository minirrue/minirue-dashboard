'use client';

import React, { useMemo, useState } from 'react';
import {
  ALIAS_MAX_LENGTH,
  KEY_MAX_LENGTH,
  LABEL_MAX_LENGTH,
  MAX_RATES,
  formatFee,
  nextGovernorateKey,
  newGovernorateDraft,
  resolveGovernorateRate,
  slugifyGovernorateKey,
  summariseRatesEffect,
  validateGovernorateRates,
  type GovernorateRateDraft,
  type RateFieldIssue,
} from '@/lib/shipping/governorate-rates';

/**
 * The admin editor for per-governorate delivery fees (minirue-backend#83).
 *
 * The owner's ask was "each governorate have a custom shipping fees so admin
 * can set global fees or custom governorate chosen on checkout as enum please,
 * and enum input value from admin and its fees for that governorate" — so the
 * table an admin builds here IS the enum the checkout select is built from.
 * Nothing about Egypt's governorates is hardcoded, in this file or on the
 * server, because a hardcoded list needs a deploy to fix a spelling.
 *
 * Four things this component exists to make impossible or visible, in the
 * order they can hurt:
 *
 *  1. A blank fee must never be saved as zero. See the fee input below and
 *     `parseFeeInput`.
 *  2. Renaming a governorate must not re-key orders already placed against it,
 *     so the ID is generated once and then frozen.
 *  3. `aliases` is the only reason this feature can ship on top of a free-text
 *     `governorate` column, and an admin who does not understand that will
 *     leave it empty and under-charge every historical address. The explainer
 *     and the spelling tester are load-bearing, not decoration.
 *  4. The consequence of a number goes next to the number — which is the
 *     global fallback, what the storefront will quote as "from", and the fact
 *     that free delivery beats every row here.
 *
 * Laid out as cards rather than a table on purpose: a table with name / ID /
 * fee / toggle / spellings / remove cannot fit 1024px without a horizontal
 * scrollbar, and a settings page that scrolls sideways is a settings page
 * where the Save button goes missing.
 */

/** Muted, mono, non-shouty — used for the frozen ID and matched spellings. */
const monoStyle: React.CSSProperties = {
  fontFamily: 'var(--mr-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
  fontSize: 12,
};

const calloutBase: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 'var(--mr-radius-sm)',
  fontSize: 13,
  lineHeight: 1.5,
  margin: 0,
};

const warnCallout: React.CSSProperties = {
  ...calloutBase,
  background: 'var(--mr-st-warn-bg)',
  color: 'var(--mr-st-warn-fg)',
};

const infoCallout: React.CSSProperties = {
  ...calloutBase,
  background: 'var(--mr-st-info-bg)',
  color: 'var(--mr-st-info-fg)',
};

export interface GovernorateRatesEditorProps {
  drafts: GovernorateRateDraft[];
  onChange: (next: GovernorateRateDraft[]) => void;
  /**
   * The global flat rate as currently typed on this page, or `null` when the
   * field is blank and nothing is stored.
   *
   * `null` is a real state and not a zero: it means the shop has never set a
   * delivery fee, and `flatRateCents` is REQUIRED by the server's shipping
   * schema, so the table cannot be saved until one exists. The banner below
   * says so rather than letting the admin fill in a table that cannot be sent.
   */
  flatRateCents: number | null;
  /** The free-delivery threshold as currently typed. 0 means no threshold. */
  freeOverCents: number;
  currency: string;
}

export default function GovernorateRatesEditor({
  drafts,
  onChange,
  flatRateCents,
  freeOverCents,
  currency,
}: GovernorateRatesEditorProps) {
  /**
   * Rows whose ID the admin has edited by hand.
   *
   * Until then a NEW row's ID follows its name, which is what makes the ID
   * feel automatic rather than like a second thing to fill in. The moment it
   * is edited it stops following, because an ID someone chose is not a
   * derived value any more.
   */
  const [handEditedKeys, setHandEditedKeys] = useState<Set<string>>(new Set());
  /** The half-typed spelling in each row's "also matches" box. */
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({});
  /** Free text in the spelling tester. Never saved; never sent anywhere. */
  const [probe, setProbe] = useState('');
  const [aliasHelpOpen, setAliasHelpOpen] = useState(false);

  const { issues, notices } = useMemo(() => validateGovernorateRates(drafts), [drafts]);
  const effect = useMemo(
    () => summariseRatesEffect(drafts, flatRateCents ?? 0, freeOverCents),
    [drafts, flatRateCents, freeOverCents],
  );

  const issuesFor = (id: string, field: RateFieldIssue['field']) =>
    issues.filter((x) => x.id === id && x.field === field);
  const noticesFor = (id: string, field: RateFieldIssue['field']) =>
    notices.filter((x) => x.id === id && x.field === field);

  const patch = (id: string, change: Partial<GovernorateRateDraft>) =>
    onChange(drafts.map((d) => (d.id === id ? { ...d, ...change } : d)));

  const handleLabelChange = (row: GovernorateRateDraft, label: string) => {
    // The ID follows the name ONLY while the row is new and unsaved and the ID
    // has not been hand-edited. A saved row's ID is frozen: it is snapshotted
    // onto every order placed against it, so re-deriving it from a renamed
    // label would silently detach this row from its own order history.
    const shouldDerive = row.isNew && !handEditedKeys.has(row.id);
    if (!shouldDerive) {
      patch(row.id, { label });
      return;
    }
    const taken = drafts.filter((d) => d.id !== row.id).map((d) => d.key);
    const key = label.trim() === '' ? '' : nextGovernorateKey(label, taken);
    patch(row.id, { label, key });
  };

  const handleAdd = () => {
    const row = newGovernorateDraft();
    onChange([...drafts, row]);
  };

  const handleRemove = (id: string) => {
    onChange(drafts.filter((d) => d.id !== id));
    setAliasDrafts((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  };

  const commitAlias = (row: GovernorateRateDraft) => {
    const raw = (aliasDrafts[row.id] ?? '').trim();
    if (raw === '') return;
    // Comma-separated so an admin can paste a handful at once, which is what
    // they will have: a column copied out of the orders list.
    const added = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '' && !row.aliases.includes(s));
    if (added.length > 0) patch(row.id, { aliases: [...row.aliases, ...added] });
    setAliasDrafts((p) => ({ ...p, [row.id]: '' }));
  };

  /**
   * The spelling tester, resolved against the table AS TYPED.
   *
   * Uses the same key-then-label-then-alias precedence the server uses, so an
   * admin can paste the governorate off a real order and see whether it lands
   * on a row or falls through to the global rate. A miss here is the exact
   * silent under-charge #83 is about, made visible before it happens.
   */
  const probeResult = useMemo(() => {
    if (probe.trim() === '') return null;
    const { rates } = validateGovernorateRates(drafts);
    return resolveGovernorateRate(rates, flatRateCents ?? 0, probe);
  }, [probe, drafts, flatRateCents]);

  const hasRates = drafts.length > 0;
  const flatKnown = flatRateCents !== null;

  return (
    <div className="dash-form-card">
      <div>
        <h2 className="dash-section-title" style={{ margin: 0 }}>
          Delivery fees by governorate
        </h2>
        <p className="dash-help-text" style={{ marginTop: 4 }}>
          Charge a different delivery fee per governorate. Anywhere you do not list
          here is charged the global delivery rate above.
        </p>
      </div>

      {/* ---- What these numbers actually do -------------------------------
          The bundles redesign (#28) put the economics of a price next to the
          price rather than behind a save; same thing here. An admin setting
          fees otherwise cannot see which fee is the fallback, what the
          storefront will quote before an address exists, or that free
          delivery quietly beats every row. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          padding: 12,
          borderRadius: 'var(--mr-radius-sm)',
          background: 'var(--mr-dash-content-bg)',
          border: '1px solid var(--mr-dash-hair)',
        }}
      >
        <Stat
          label="Global fallback"
          value={flatKnown ? formatFee(effect.globalFeeCents, currency) : 'Not set'}
          hint="Charged to every governorate you have not listed"
        />
        <Stat
          label="Storefront quotes"
          value={flatKnown ? `from ${formatFee(effect.minFeeCents, currency)}` : '—'}
          hint="Shown in the bag before a shopper enters an address"
        />
        <Stat
          label="Most expensive"
          value={flatKnown ? formatFee(effect.maxFeeCents, currency) : '—'}
          hint={effect.maxFeeLabel ? `${effect.maxFeeLabel}` : 'The global rate — no row costs more'}
        />
      </div>

      {!flatKnown && (
        <p style={warnCallout}>
          Set the <strong>global delivery rate</strong> above before adding
          governorates. It is what every governorate you do not list gets charged,
          and the table cannot be saved without it.
        </p>
      )}

      {effect.freeOverCents > 0 && (
        <p style={infoCallout}>
          Free delivery over {formatFee(effect.freeOverCents, currency)}{' '}
          <strong>overrides every rate below</strong>. A shopper spending that much
          pays nothing to ship
          {effect.maxFeeLabel
            ? `, even in ${effect.maxFeeLabel} at ${formatFee(effect.maxFeeCents, currency)}.`
            : '.'}{' '}
          Raise or clear the threshold above if a remote governorate should still
          be charged.
        </p>
      )}

      {effect.disabledUndercutsQuote && (
        <p style={warnCallout}>
          A governorate that is not offered at checkout is priced below the{' '}
          {formatFee(effect.minFeeCents, currency)} the storefront quotes as
          &ldquo;from&rdquo; — and it is still charged, because not offering a
          governorate is not enforced yet. Shoppers there will pay less than the
          advertised starting price.
        </p>
      )}

      {/* ---- Empty state --------------------------------------------------
          Stated in words, because "no rows" and "free shipping" look
          identical on screen and are opposite things. */}
      {!hasRates && (
        <div
          data-testid="gov-rates-empty"
          style={{
            padding: 16,
            borderRadius: 'var(--mr-radius-sm)',
            border: '1px dashed var(--mr-dash-hair)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            No governorate rates
          </p>
          <p className="dash-help-text" style={{ marginTop: 6 }}>
            Every order is charged the global delivery rate
            {flatKnown ? ` of ${formatFee(effect.globalFeeCents, currency)}` : ''}.
            This is <strong>not</strong> free delivery — leaving this table empty
            changes nothing about what shoppers pay.
          </p>
        </div>
      )}

      {hasRates && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {drafts.map((row) => {
            const labelIssues = issuesFor(row.id, 'label');
            const keyIssues = issuesFor(row.id, 'key');
            const feeIssues = issuesFor(row.id, 'fee');
            const aliasIssues = issuesFor(row.id, 'aliases');
            const feeNotices = noticesFor(row.id, 'fee');
            const aliasNotices = noticesFor(row.id, 'aliases');
            return (
              <li
                key={row.id}
                data-testid="gov-rate-row"
                style={{
                  border: '1px solid var(--mr-dash-hair)',
                  borderRadius: 'var(--mr-radius-sm)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <div className="dash-field-row">
                  <div className="dash-field" style={{ minWidth: 180 }}>
                    <label className="dash-label" htmlFor={`${row.id}-label`}>
                      Governorate
                    </label>
                    <input
                      id={`${row.id}-label`}
                      type="text"
                      className={`dash-input${labelIssues.length ? ' dash-input-error' : ''}`}
                      value={row.label}
                      maxLength={LABEL_MAX_LENGTH}
                      placeholder="Cairo"
                      onChange={(e) => handleLabelChange(row, e.target.value)}
                    />
                    {labelIssues.map((x, i) => (
                      <p className="dash-field-error" key={i}>{x.message}</p>
                    ))}
                  </div>

                  <div className="dash-field" style={{ minWidth: 140, flexGrow: 0, flexBasis: 160 }}>
                    <label className="dash-label" htmlFor={`${row.id}-fee`}>
                      Delivery fee ({currency || 'EGP'})
                    </label>
                    {/*
                      NOT `type="number"` with a `0` default, and not `value={0}`.
                      An untouched numeric field that reports 0 is precisely the
                      hero-colour-picker trap (#26): the admin never chose it, and
                      what gets written is a real, chargeable free delivery.
                      Blank stays blank, blank is invalid, and the error below
                      says so in those words.
                    */}
                    <input
                      id={`${row.id}-fee`}
                      type="text"
                      inputMode="decimal"
                      className={`dash-input${feeIssues.length ? ' dash-input-error' : ''}`}
                      value={row.feeInput}
                      placeholder="e.g. 70.00"
                      onChange={(e) => patch(row.id, { feeInput: e.target.value })}
                    />
                    {feeIssues.map((x, i) => (
                      <p className="dash-field-error" key={i}>{x.message}</p>
                    ))}
                    {feeNotices.map((x, i) => (
                      <p className="dash-help-text" key={i} style={{ color: 'var(--mr-st-warn-fg)' }}>
                        {x.message}
                      </p>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    <button
                      type="button"
                      className="dash-btn-ghost"
                      onClick={() => handleRemove(row.id)}
                      aria-label={`Remove ${row.label.trim() || 'this governorate'}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* ---- The ID, and why it does not move ---------------- */}
                <div className="dash-field-row" style={{ alignItems: 'center' }}>
                  {row.isNew ? (
                    <div className="dash-field" style={{ minWidth: 180 }}>
                      <label className="dash-label" htmlFor={`${row.id}-key`}>
                        ID
                      </label>
                      <input
                        id={`${row.id}-key`}
                        type="text"
                        className={`dash-input${keyIssues.length ? ' dash-input-error' : ''}`}
                        style={monoStyle}
                        value={row.key}
                        maxLength={KEY_MAX_LENGTH}
                        placeholder={slugifyGovernorateKey(row.label) || 'cairo'}
                        onChange={(e) => {
                          setHandEditedKeys((p) => new Set(p).add(row.id));
                          patch(row.id, { key: e.target.value });
                        }}
                      />
                      <p className="dash-help-text">
                        Generated from the name. Editable until you save — after that
                        it is fixed, because every order placed against this
                        governorate records it.
                      </p>
                      {keyIssues.map((x, i) => (
                        <p className="dash-field-error" key={i}>{x.message}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="dash-field" style={{ minWidth: 180 }}>
                      <span className="dash-label">ID</span>
                      <span style={{ ...monoStyle, color: 'var(--mr-fg-4)' }} data-testid="gov-rate-frozen-key">
                        {row.key}
                      </span>
                      <p className="dash-help-text">
                        Fixed. Orders already placed here record this ID, so renaming
                        the governorate above is safe — it changes what shoppers see,
                        not what past orders mean.
                      </p>
                    </div>
                  )}

                  <div className="dash-field" style={{ minWidth: 180 }}>
                    <label className="dash-checkbox-label">
                      <input
                        type="checkbox"
                        className="dash-checkbox"
                        checked={row.enabled}
                        onChange={(e) => patch(row.id, { enabled: e.target.checked })}
                      />
                      Offer at checkout
                    </label>
                    {!row.enabled && (
                      <p className="dash-help-text" style={{ color: 'var(--mr-st-warn-fg)' }}>
                        Not enforced yet — a shopper here is still charged this fee.
                        Unchecking only removes it from the &ldquo;from&rdquo; price
                        the storefront quotes.
                      </p>
                    )}
                  </div>
                </div>

                {/* ---- Historical spellings ---------------------------- */}
                <div className="dash-field" style={{ minWidth: 0 }}>
                  <label className="dash-label" htmlFor={`${row.id}-alias`}>
                    Other spellings that mean {row.label.trim() || 'this governorate'}
                  </label>
                  {row.aliases.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                      {row.aliases.map((alias) => (
                        <span
                          key={alias}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: 'var(--mr-st-muted-bg)',
                            color: 'var(--mr-st-muted-fg)',
                            fontSize: 12,
                            maxWidth: '100%',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {alias}
                          <button
                            type="button"
                            onClick={() =>
                              patch(row.id, { aliases: row.aliases.filter((a) => a !== alias) })
                            }
                            aria-label={`Remove spelling ${alias}`}
                            style={{
                              border: 0,
                              background: 'transparent',
                              cursor: 'pointer',
                              color: 'inherit',
                              padding: 0,
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      id={`${row.id}-alias`}
                      type="text"
                      className={`dash-input${aliasIssues.length ? ' dash-input-error' : ''}`}
                      style={{ flex: '1 1 180px', minWidth: 0 }}
                      maxLength={ALIAS_MAX_LENGTH * 4}
                      value={aliasDrafts[row.id] ?? ''}
                      placeholder="cairo, Cairo Governorate, القاهرة"
                      onChange={(e) => setAliasDrafts((p) => ({ ...p, [row.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Inside a <form>: Enter would submit the whole
                          // settings page instead of adding a spelling.
                          e.preventDefault();
                          commitAlias(row);
                        }
                      }}
                      onBlur={() => commitAlias(row)}
                    />
                    <button type="button" className="dash-btn-secondary" onClick={() => commitAlias(row)}>
                      Add
                    </button>
                  </div>
                  <p className="dash-help-text">
                    Casing, punctuation, &ldquo;Governorate&rdquo;/&ldquo;محافظة&rdquo;
                    and Arabic letter forms are already matched automatically. Add the
                    ones that are genuinely different words.
                  </p>
                  {aliasIssues.map((x, i) => (
                    <p className="dash-field-error" key={i}>{x.message}</p>
                  ))}
                  {aliasNotices.map((x, i) => (
                    <p className="dash-help-text" key={i} style={{ fontStyle: 'italic' }}>{x.message}</p>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="dash-btn-secondary"
          onClick={handleAdd}
          disabled={drafts.length >= MAX_RATES}
        >
          Add governorate
        </button>
        {drafts.length >= MAX_RATES && (
          <span className="dash-help-text">Maximum of {MAX_RATES} governorates reached.</span>
        )}
      </div>

      {/* ---- Why spellings matter -----------------------------------------
          An admin who does not read this leaves the spellings empty and
          under-charges every address written before the checkout select
          existed. It is opened by default the moment there is a table to get
          wrong. */}
      <div style={{ border: '1px solid var(--mr-dash-hair)', borderRadius: 'var(--mr-radius-sm)', padding: 12 }}>
        <button
          type="button"
          className="dash-btn-ghost"
          onClick={() => setAliasHelpOpen((v) => !v)}
          aria-expanded={aliasHelpOpen}
          style={{ padding: 0 }}
        >
          {aliasHelpOpen ? '▾' : '▸'} Why spellings matter, and how to check yours
        </button>
        {aliasHelpOpen && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="dash-help-text" style={{ fontSize: 13 }}>
              Until this table existed, shoppers <strong>typed</strong> their
              governorate. Saved addresses already hold &ldquo;Cairo&rdquo;,
              &ldquo;cairo&rdquo;, &ldquo;القاهرة&rdquo;, &ldquo;Cairo
              Governorate&rdquo; and — on orders taken by phone — a bare
              &ldquo;—&rdquo;. Those addresses are still used at checkout.
            </p>
            <p className="dash-help-text" style={{ fontSize: 13 }}>
              A spelling that matches nothing here is not an error: that order is
              simply charged the global rate, quietly. That is how a shop
              under-charges for months without noticing. Adding the spelling to the
              right governorate fixes it for every past and future address at once.
            </p>
            <div className="dash-field">
              <label className="dash-label" htmlFor="gov-rate-probe">
                Test a spelling
              </label>
              <input
                id="gov-rate-probe"
                type="text"
                className="dash-input"
                value={probe}
                placeholder="Paste a governorate from an order, e.g. cairo governorate"
                onChange={(e) => setProbe(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
              />
              <p className="dash-help-text">
                Nothing is saved or sent. This only shows which row that text would
                land on.
              </p>
            </div>
            {probeResult && (
              <p
                data-testid="gov-rate-probe-result"
                style={
                  probeResult.status === 'MATCHED'
                    ? { ...calloutBase, background: 'var(--mr-st-ok-bg)', color: 'var(--mr-st-ok-fg)' }
                    : warnCallout
                }
              >
                {probeResult.status === 'MATCHED' && (
                  <>
                    Matches <strong>{probeResult.label}</strong> on its{' '}
                    {probeResult.matchedOn === 'KEY'
                      ? 'ID'
                      : probeResult.matchedOn === 'LABEL'
                        ? 'name'
                        : 'spellings'}
                    . Charged {formatFee(probeResult.baseFeeCents, currency)}.
                  </>
                )}
                {probeResult.status === 'DISABLED' && (
                  <>
                    Matches <strong>{probeResult.label}</strong>, which is not offered
                    at checkout — and is still charged{' '}
                    {formatFee(probeResult.baseFeeCents, currency)} today.
                  </>
                )}
                {probeResult.status === 'NO_MATCH' && (
                  <>
                    <strong>No match.</strong> An address spelled this way is charged
                    the global rate of{' '}
                    {formatFee(probeResult.baseFeeCents, currency)} with nothing to
                    show for it. Add it as a spelling on the governorate it belongs
                    to.
                  </>
                )}
                {probeResult.status === 'NO_GOVERNORATE' && (
                  <>
                    That text names nowhere — blank, or placeholder punctuation like
                    the &ldquo;—&rdquo; a phone order writes. Charged the global rate
                    of {formatFee(probeResult.baseFeeCents, currency)}. No spelling
                    can fix this one; the address itself has to be corrected.
                  </>
                )}
                {probeResult.status === 'NO_RATES' && (
                  <>
                    There are no governorate rates yet, so everything is charged the
                    global rate of {formatFee(probeResult.baseFeeCents, currency)}.
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
      <div className="dash-metric-eyebrow" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mr-fg-4)' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</div>
      <div className="dash-help-text" style={{ fontSize: 12 }}>{hint}</div>
    </div>
  );
}
