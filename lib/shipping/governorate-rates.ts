/**
 * The admin side of per-governorate delivery fees (minirue-backend#83).
 *
 * The backend half is already live: `shipping.rates` is stored in the
 * `store_settings.payload` jsonb, resolved by checkout, and published on
 * `GET /v1/settings/public`. This file is what the dashboard needs to EDIT
 * that table safely — the drafting shape, the validation that mirrors the
 * server's write schema, and the arithmetic that lets the editor show an
 * admin what their numbers actually do.
 *
 * ## Why any of this is here rather than inline in the editor
 *
 * One malformed value fails zod for the WHOLE settings document — currency,
 * VAT, brand, everything — so an admin loses an entire editing session over a
 * stray row. `normalizeStorefrontLayoutForSave` (lib/api/storefront.ts) exists
 * for that exact reason and this is the same trade: check on the way out,
 * where the admin can still fix it, rather than discovering it as a 400.
 *
 * ## The one thing that must not be got wrong
 *
 * **An empty fee is not a free delivery.** `feeCents` is `z.number().int()` on
 * the wire, so a form that defaults an untouched field to `0` writes a real,
 * chargeable "this governorate ships for nothing" — the same null-vs-default
 * trap the hero colour pickers had (minirue-dashboard#26), where
 * `<input type="color">` reports `#000000` for "untouched" and would have
 * painted every slide black. So the draft fee is a STRING, `null` means
 * "nothing typed", `null` is INVALID and blocks the save, and `0` is only ever
 * reached by an admin actually typing a zero.
 *
 * ## About the copied normalisation
 *
 * `normaliseGovernorate` and `resolveGovernorateRate` below are ports of
 * `minirue-backend/src/settings/shipping-policy.ts`. #83 is explicit that a
 * hand-kept mirror of the checkout arithmetic is how "the cart says 50 and the
 * invoice says 120" happens, so to be clear about what these are for: they are
 * ADVISORY ONLY. Nothing here decides what anyone is billed. They power two
 * things in the editor — the duplicate-spelling check that stops a save the
 * server would reject anyway, and the "test a spelling" box that lets an admin
 * paste a real address value and see which row it lands on. The server
 * re-validates and re-resolves either way, so drift here shows up as a warning
 * that was too strict or too lax, never as a wrong charge.
 */

/** One row of the admin's table, in the shape the API stores and returns. */
export interface GovernorateRate {
  /**
   * Stable, machine-facing, and snapshotted onto every order placed against
   * it. Renaming `label` must never re-key an order that has already been
   * placed, which is the whole reason this field is separate from the label.
   */
  key: string;
  /** What a shopper sees in the checkout select. Cosmetic; safe to rename. */
  label: string;
  /** Minor units. Never absent on the wire — see the fee note in the header. */
  feeCents: number;
  /**
   * Modelled but NOT enforced by the backend (#83 decision 3). A disabled row
   * still matches and is still charged today; it is excluded only from
   * `minFeeCents`, the "from EGP X" the storefront quotes. The editor has to
   * say so, because "disabled" reads as "we do not deliver here" and that is
   * not what it does yet.
   */
  enabled: boolean;
  /**
   * Historical free-text spellings that map onto this key. `governorate` has
   * been free text on every address since the schema was written, so live rows
   * hold "Cairo", "cairo", "القاهرة", "Cairo Governorate" and the literal '—'.
   * This is how an admin maps those without a code change.
   */
  aliases: string[];
}

/** Mirrors `GovernorateRateSchema` in the backend's update-settings.dto.ts. */
export const KEY_MAX_LENGTH = 64;
export const LABEL_MAX_LENGTH = 120;
export const ALIAS_MAX_LENGTH = 120;
export const MAX_ALIASES_PER_RATE = 50;
export const MAX_RATES = 100;
/** `z.number().int().min(0).max(10_000_000)` — EGP 100,000.00. */
export const MAX_FEE_CENTS = 10_000_000;
/** `^[\p{L}\p{N}][\p{L}\p{N}_-]*$` — no whitespace, non-ASCII letters welcome. */
export const KEY_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u;

// ===========================================================================
// Normalisation — an ADVISORY port. See the header.
// ===========================================================================

/** Tatweel and the Arabic harakat. Decorative; never identity. */
const ARABIC_MARKS = /[ـً-ٰٟ]/g;
/** Everything that is neither a letter, a digit, nor a space. */
const NOT_IDENTITY = /[^\p{L}\p{N} ]+/gu;
/** "Cairo Governorate", "Cairo gov." — the suffix carries no identity. */
const EN_SUFFIX = /\s+(governorate|governate|gov)$/;
/** The Arabic equivalent, which leads rather than trails. */
const AR_PREFIX = /^(محافظة|محافظه)\s+/;

/**
 * The free text reduced to something two spellings of one place share.
 *
 * `null` for anything that identifies nowhere — a non-string, an empty string,
 * and placeholder punctuation, notably the '—' the backend's manual-order path
 * writes when an admin took only a phone number. `null` is a MISS, never a
 * match.
 *
 * Line-for-line with the backend's `normaliseGovernorate`; the test suite
 * pins the same case table its spec does, so a divergence is a failing test
 * rather than a warning that quietly stopped agreeing with the server.
 */
export function normaliseGovernorate(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  let s = value.normalize('NFKC').replace(ARABIC_MARKS, '').toLowerCase();

  // Arabic orthography Egyptian shoppers type interchangeably. Folding these
  // is the difference between "القاهرة" and "القاهره" being one place and
  // being two, only one of which has a rate.
  s = s
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

  s = s.replace(NOT_IDENTITY, ' ').replace(/ +/g, ' ').trim();
  s = s.replace(AR_PREFIX, '').replace(EN_SUFFIX, '').trim();

  return s.length > 0 ? s : null;
}

export type GovernorateMatchStatus =
  | 'NO_RATES'
  | 'MATCHED'
  | 'DISABLED'
  | 'NO_GOVERNORATE'
  | 'NO_MATCH';

export type GovernorateMatchedOn = 'KEY' | 'LABEL' | 'ALIAS';

export interface ResolvedGovernorateRate {
  status: GovernorateMatchStatus;
  key: string | null;
  label: string | null;
  matchedOn: GovernorateMatchedOn | null;
  /** The fee this resolution selects, BEFORE any free-shipping threshold. */
  baseFeeCents: number;
}

/**
 * Which rate a free-text governorate gets, and — when none — why not.
 *
 * Precedence is KEY, then LABEL, then ALIAS, each swept across the WHOLE table
 * before the next is tried, so an alias added to Giza cannot steal an address
 * that names Cairo's key outright. Same order as the server.
 */
export function resolveGovernorateRate(
  rates: GovernorateRate[],
  flatRateCents: number,
  governorate: unknown,
): ResolvedGovernorateRate {
  const miss = (status: GovernorateMatchStatus): ResolvedGovernorateRate => ({
    status,
    key: null,
    label: null,
    matchedOn: null,
    baseFeeCents: flatRateCents,
  });

  if (rates.length === 0) return miss('NO_RATES');

  const needle = normaliseGovernorate(governorate);
  if (needle === null) return miss('NO_GOVERNORATE');

  const passes: Array<[GovernorateMatchedOn, (r: GovernorateRate) => string[]]> = [
    ['KEY', (r) => [r.key]],
    ['LABEL', (r) => [r.label]],
    ['ALIAS', (r) => r.aliases],
  ];

  for (const [matchedOn, fieldsOf] of passes) {
    for (const rate of rates) {
      if (!fieldsOf(rate).some((f) => normaliseGovernorate(f) === needle)) continue;
      return {
        status: rate.enabled ? 'MATCHED' : 'DISABLED',
        key: rate.key,
        label: rate.label,
        matchedOn,
        baseFeeCents: rate.feeCents,
      };
    }
  }

  return miss('NO_MATCH');
}

// ===========================================================================
// Keys — generated once, then frozen
// ===========================================================================

/**
 * A label reduced to something the server's key regex accepts.
 *
 * Not a transliteration: an Arabic label yields an Arabic key, because the
 * write schema allows `\p{L}` beyond ASCII precisely so an Egyptian admin is
 * not made to invent a Latin slug — a slug they invent is a slug they can
 * mistype.
 *
 * Returns `''` when the label carries no identity at all (only punctuation);
 * `nextGovernorateKey` supplies the fallback rather than this function
 * inventing one, so the caller controls what an unnameable row is called.
 */
export function slugifyGovernorateKey(label: string): string {
  const slug = label
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, KEY_MAX_LENGTH)
    // A trailing hyphen can reappear after the slice.
    .replace(/-+$/g, '');
  return KEY_PATTERN.test(slug) ? slug : '';
}

/**
 * A key for a NEW row that no existing row has claimed.
 *
 * Suffixes rather than overwrites, because the alternative — silently reusing
 * an existing key — would point two visible rows at one fee and the server
 * would reject the whole save anyway.
 */
export function nextGovernorateKey(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugifyGovernorateKey(label) || 'governorate';
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base.slice(0, KEY_MAX_LENGTH - 5)}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  /* istanbul ignore next -- 1000 rows is 10x the server's cap of 100. */
  return `${base.slice(0, KEY_MAX_LENGTH - 14)}-${Date.now()}`;
}

// ===========================================================================
// Drafts — what the editor actually holds
// ===========================================================================

/**
 * A row mid-edit.
 *
 * `feeInput` is a STRING and not a number, and that is the point of this type.
 * A numeric field defaulted to `0` for an untouched row is a governorate that
 * ships free, written by an admin who never chose it — see the header.
 */
export interface GovernorateRateDraft {
  /** React list identity. Never sent; `key` is not stable enough while typing. */
  id: string;
  key: string;
  label: string;
  /** Major units, exactly as typed. `''` means nothing has been entered. */
  feeInput: string;
  enabled: boolean;
  aliases: string[];
  /**
   * True for a row created in this session and never yet saved.
   *
   * This is what makes the key rule enforceable: a row the server has never
   * seen cannot be referenced by an order, so its key is still free to change.
   * Once saved, the key is frozen — an order snapshot points at it.
   */
  isNew: boolean;
}

let draftSeq = 0;
function nextDraftId(): string {
  draftSeq += 1;
  return `gov-draft-${draftSeq}`;
}

/** Minor units to the major-unit string the input shows. */
export function feeCentsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * What the admin typed, as minor units — or `null` for "nothing usable".
 *
 * `null` is returned for blank, for whitespace, for a non-number and for a
 * negative, and every one of those blocks the save. It is emphatically NOT
 * coerced to `0`: `0` is a real fee that this shop will honour, and it has to
 * be reached by typing it.
 */
export function parseFeeInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Reject anything that is not a plain decimal number outright, rather than
  // letting parseFloat salvage a prefix — "50abc" is a typo, not fifty.
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const cents = Math.round(parseFloat(trimmed) * 100);
  if (!Number.isFinite(cents) || cents < 0) return null;
  return cents;
}

/** Server rows to editable drafts. Every row here is one the server has seen. */
export function ratesToDrafts(rates: GovernorateRate[] | undefined | null): GovernorateRateDraft[] {
  if (!Array.isArray(rates)) return [];
  return rates.map((r) => ({
    id: nextDraftId(),
    key: typeof r.key === 'string' ? r.key : '',
    label: typeof r.label === 'string' ? r.label : '',
    // A stored row that somehow has no numeric fee becomes a BLANK draft, not
    // a zero one. Blank is invalid and the admin is asked; zero would ship it
    // free on the next save of an unrelated field.
    feeInput: typeof r.feeCents === 'number' && Number.isFinite(r.feeCents) && r.feeCents >= 0
      ? feeCentsToInput(r.feeCents)
      : '',
    enabled: r.enabled !== false,
    aliases: Array.isArray(r.aliases) ? r.aliases.filter((a) => typeof a === 'string' && a.trim() !== '') : [],
    isNew: false,
  }));
}

/** A fresh row. Blank fee, blank label, no key until a label exists. */
export function newGovernorateDraft(): GovernorateRateDraft {
  return { id: nextDraftId(), key: '', label: '', feeInput: '', enabled: true, aliases: [], isNew: true };
}

// ===========================================================================
// Validation — a mirror of the server's write schema, run where it can be fixed
// ===========================================================================

/** One problem with one row, addressed to the field that owns it. */
export interface RateFieldIssue {
  /** `id` of the offending draft. */
  id: string;
  field: 'label' | 'key' | 'fee' | 'aliases';
  message: string;
}

export interface ValidateRatesResult {
  /** Wire-ready rows. Only meaningful when `issues` is empty. */
  rates: GovernorateRate[];
  issues: RateFieldIssue[];
  /**
   * Non-blocking observations worth putting on screen — a deliberate free
   * delivery, a redundant alias, a disabled row cheaper than the quoted "from"
   * price. Advisory, in the spirit of `heroImageWarning`: they explain, they
   * never stop a save.
   */
  notices: RateFieldIssue[];
}

/**
 * Turns drafts into the array to PATCH, or into the reasons it cannot be sent.
 *
 * Deliberately BLOCKS rather than dropping bad rows. `normalizeStorefrontLayoutForSave`
 * drops an unfinished nav item because a missing nav item is a cosmetic loss;
 * a dropped governorate row is a shopper charged the wrong fee, silently,
 * which is the entire defect class #83 exists to close. So a row that cannot
 * be sent stops the save and says which field to fix.
 */
export function validateGovernorateRates(drafts: GovernorateRateDraft[]): ValidateRatesResult {
  const issues: RateFieldIssue[] = [];
  const notices: RateFieldIssue[] = [];
  const rates: GovernorateRate[] = [];

  if (drafts.length > MAX_RATES) {
    issues.push({
      id: drafts[MAX_RATES].id,
      field: 'label',
      message: `Only ${MAX_RATES} governorates can be saved. Remove ${drafts.length - MAX_RATES} of them.`,
    });
  }

  for (const d of drafts) {
    const label = d.label.trim();
    const key = d.key.trim();

    if (label === '') {
      issues.push({ id: d.id, field: 'label', message: 'Give this governorate a name — it is what the shopper picks at checkout.' });
    } else if (label.length > LABEL_MAX_LENGTH) {
      issues.push({ id: d.id, field: 'label', message: `Names can be at most ${LABEL_MAX_LENGTH} characters.` });
    }

    if (key === '') {
      issues.push({ id: d.id, field: 'key', message: 'This row has no ID. Type a name and one is generated for you.' });
    } else if (key.length > KEY_MAX_LENGTH) {
      issues.push({ id: d.id, field: 'key', message: `IDs can be at most ${KEY_MAX_LENGTH} characters.` });
    } else if (!KEY_PATTERN.test(key)) {
      issues.push({ id: d.id, field: 'key', message: 'An ID can only contain letters, digits, _ and - and must start with a letter or digit.' });
    }

    const feeCents = parseFeeInput(d.feeInput);
    if (feeCents === null) {
      // THE row-level expression of the empty-is-not-free rule.
      issues.push({
        id: d.id,
        field: 'fee',
        message: `Enter a delivery fee for ${label || 'this governorate'}. A blank fee is not free delivery — type 0 if you really mean free.`,
      });
    } else if (feeCents > MAX_FEE_CENTS) {
      issues.push({ id: d.id, field: 'fee', message: `That fee is above the maximum of ${(MAX_FEE_CENTS / 100).toLocaleString()}.` });
    } else if (feeCents === 0) {
      notices.push({ id: d.id, field: 'fee', message: `Free delivery to ${label || 'this governorate'} — shoppers here pay nothing to ship.` });
    }

    const aliases: string[] = [];
    for (const raw of d.aliases) {
      const alias = raw.trim();
      if (alias === '') continue;
      if (alias.length > ALIAS_MAX_LENGTH) {
        issues.push({ id: d.id, field: 'aliases', message: `"${alias.slice(0, 24)}…" is too long — spellings can be at most ${ALIAS_MAX_LENGTH} characters.` });
        continue;
      }
      aliases.push(alias);
    }
    if (aliases.length > MAX_ALIASES_PER_RATE) {
      issues.push({ id: d.id, field: 'aliases', message: `At most ${MAX_ALIASES_PER_RATE} spellings per governorate.` });
    }

    rates.push({
      key,
      label,
      feeCents: feeCents ?? 0,
      enabled: d.enabled,
      aliases,
    });
  }

  // ---- Cross-row checks. These mirror `ShippingConfigSchema.superRefine`. --
  //
  // Run here and not only on the server because the server's rejection fails
  // the WHOLE settings document: an admin who typed "Cairo" twice would lose
  // their currency and VAT edits in the same save and get one opaque message
  // about `rates[3]`.

  const byKey = new Map<string, string>();
  drafts.forEach((d, i) => {
    const key = rates[i].key;
    if (key === '') return;
    if (byKey.has(key)) {
      issues.push({ id: d.id, field: 'key', message: `Another governorate already uses the ID "${key}". IDs must be unique.` });
      return;
    }
    byKey.set(key, d.id);
  });

  /**
   * One spelling cannot select two fees.
   *
   * The server checks the NORMALISED form of every key, label and alias across
   * the whole table, so "Cairo" as Giza's alias collides with Cairo's own
   * label even though the strings differ. Reproducing that here is why the
   * normalisation port above exists.
   */
  type TokenOrigin = 'key' | 'label' | 'alias';
  const claimed = new Map<string, { key: string; id: string; token: string }>();
  drafts.forEach((d, i) => {
    const rate = rates[i];
    if (rate.key === '') return;
    const tokens: Array<[TokenOrigin, string]> = [
      ['key', rate.key],
      ['label', rate.label],
      ...rate.aliases.map((a): [TokenOrigin, string] => ['alias', a]),
    ];
    // One notice per redundant spelling, not one per repetition of it.
    const alreadyNoticed = new Set<string>();
    for (const [origin, token] of tokens) {
      const norm = normaliseGovernorate(token);
      if (norm === null) continue;
      const owner = claimed.get(norm);
      if (!owner) {
        claimed.set(norm, { key: rate.key, id: d.id, token });
        continue;
      }
      if (owner.key !== rate.key) {
        issues.push({
          id: d.id,
          field: origin === 'alias' ? 'aliases' : origin,
          message: `"${token}" already matches "${owner.token}" on another governorate — one spelling cannot select two fees.`,
        });
        continue;
      }
      // Same row. A spelling that merely repeats this row's own key or label
      // is harmless, but an admin who typed it expects it to be doing
      // something. Say so quietly rather than letting it look load-bearing.
      if (origin === 'alias' && !alreadyNoticed.has(norm)) {
        alreadyNoticed.add(norm);
        notices.push({
          id: d.id,
          field: 'aliases',
          message: `"${token}" is already matched by "${owner.token}" — keeping it changes nothing.`,
        });
      }
    }
  });

  return { rates, issues, notices };
}

// ===========================================================================
// The effect — what these numbers actually do
// ===========================================================================

export interface RatesEffect {
  /** What an address matching no row is charged. The table's fallback. */
  globalFeeCents: number;
  /**
   * The cheapest delivery anyone can be quoted: the minimum of the global rate
   * and every ENABLED row's fee.
   *
   * Computed exactly as the server computes `minFeeCents`, because this is the
   * number the storefront renders as "from EGP X" before an address exists.
   * Disabled rows are excluded — the server excludes them — which is also why
   * `disabledUndercutsQuote` below has to exist.
   */
  minFeeCents: number;
  /** The dearest chargeable row, or the global rate when the table is empty. */
  maxFeeCents: number;
  /** The label carrying `maxFeeCents`, or null when that is the global rate. */
  maxFeeLabel: string | null;
  /** Rows in the table, valid or not. */
  rateCount: number;
  /** Rows flagged disabled — still charged today. See `GovernorateRate.enabled`. */
  disabledCount: number;
  /**
   * True when a disabled row's fee is BELOW the published "from" price.
   *
   * The backend excludes disabled rows from `minFeeCents` but still charges
   * them, so this combination means the storefront advertises "from EGP 70"
   * while a shopper in that governorate is billed EGP 50. Not wrong, exactly —
   * but it is surprising enough that an admin should be told.
   */
  disabledUndercutsQuote: boolean;
  /**
   * The free-delivery threshold, or 0 for "no threshold".
   *
   * When set it BEATS every row below it — `FREE_SHIPPING_BEATS_GOVERNORATE_RATE`
   * is `true` in the backend — so a shopper over the threshold in the most
   * expensive governorate still pays nothing.
   */
  freeOverCents: number;
}

/**
 * The live read-out the editor shows while an admin types.
 *
 * Same idea as the bundle editor's economics panel (minirue-dashboard#28):
 * the consequence of the number goes next to the number, not behind a save and
 * a trip to the storefront. Rows whose fee is blank are simply not counted —
 * they have no fee to be cheapest or dearest yet.
 */
export function summariseRatesEffect(
  drafts: GovernorateRateDraft[],
  flatRateCents: number,
  freeOverCents: number,
): RatesEffect {
  const priced = drafts
    .map((d) => ({ d, feeCents: parseFeeInput(d.feeInput) }))
    .filter((x): x is { d: GovernorateRateDraft; feeCents: number } => x.feeCents !== null);

  const enabled = priced.filter((x) => x.d.enabled);
  const minFeeCents = enabled.reduce((min, x) => Math.min(min, x.feeCents), flatRateCents);

  let maxFeeCents = flatRateCents;
  let maxFeeLabel: string | null = null;
  for (const x of priced) {
    if (x.feeCents > maxFeeCents) {
      maxFeeCents = x.feeCents;
      maxFeeLabel = x.d.label.trim() || x.d.key;
    }
  }

  const disabled = priced.filter((x) => !x.d.enabled);

  return {
    globalFeeCents: flatRateCents,
    minFeeCents,
    maxFeeCents,
    maxFeeLabel,
    rateCount: drafts.length,
    disabledCount: drafts.filter((d) => !d.enabled).length,
    disabledUndercutsQuote: disabled.some((x) => x.feeCents < minFeeCents),
    freeOverCents,
  };
}

/** `7000` -> `"EGP 70.00"`. Currency first, because that is how the rest of the dashboard reads. */
export function formatFee(cents: number, currency: string): string {
  const major = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency || 'EGP'} ${major}`;
}
