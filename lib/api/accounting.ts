import { apiFetch } from './client';

/**
 * Typed client for the whole `/v1/accounting` contract (epic
 * minirue-backend#155, "API contract"). Every route is ADMIN-only on the
 * backend. Money is always integer minor units (piastres); percentages are
 * basis points (`Bp`, 10000 = 100%).
 *
 * Field names follow the backend pricing engine exactly (`priceMinor`,
 * `floors.law1Minor`, `band.loMinor`, `flags`, `trace`) so the screens can
 * render the engine's own trace without a mapping layer.
 */

// ── Pricing engine output ────────────────────────────────────────────────────

export type PriceFlag = 'CANT_COMPETE' | 'THIN_MARGIN' | 'NO_MARKET' | 'NO_COST';

/** One step of how a price was reached. The "why" sentence is built from these. */
export interface PriceTraceStep {
  /** COST · FULFILLMENT · LAW1 · LAW1_SHOWN · NO_LOSS · NO_LOSS_SHOWN · MARKET · BAND_LO · BAND_HI · MEMBERS · SAVING · TARGET · PRICE · FLAG */
  step: string;
  /** Null on FLAG steps, whose `note` is the flag name. TARGET may be fractional. */
  valueMinor: number | null;
  note: string;
}

export type PriceTrace = PriceTraceStep[];

export interface PriceFloors {
  /** cost + box & trip. System prices never go below it. */
  law1Minor: number;
  /** cost + max(0, box & trip − delivery fee). Discounts stop here. */
  noLossMinor: number;
  /** Law 1 rounded up to …9, as shown to the admin. */
  law1ShownMinor: number;
  /** No-loss floor rounded up to …9; checkout caps at exactly this figure. */
  noLossShownMinor: number;
}

export interface PriceBand {
  loMinor: number;
  hiMinor: number;
}

/**
 * Mirrors the backend engine's `PriceResult`: without a cost there are no
 * floors, band, margin or profit (a set with a member missing its cost still
 * has a price).
 */
export interface PriceResult {
  priceMinor: number | null;
  floors: PriceFloors | null;
  band: PriceBand | null;
  /** Median of the competitor prices entered; null when there are none. */
  marketMinor: number | null;
  marginBp: number | null;
  markupBp: number | null;
  /** Profit after box & trip. */
  productProfitMinor: number | null;
  /** Order profit including the delivery fee. */
  orderProfitMinor: number | null;
  flags: PriceFlag[];
  trace: PriceTrace;
}

// ── Settings (`pricing` namespace) ───────────────────────────────────────────

export type PriceKnowledge = 'KNOWN_PRICE' | 'KNOWN_BRAND' | 'UNCOMPARABLE';
export type PricingMode = 'SYSTEM' | 'MANUAL';
export type CostCurrency = 'EGP' | 'USD';
export type PriceRounding = 'END_9' | 'NONE';

export interface FulfillmentItem {
  id: string;
  label: string;
  amountMinor: number;
}

export interface ClassRule {
  undercutBp: number;
  premiumBp: number;
  noMarketMinBp: number;
  noMarketMaxBp: number;
}

export interface UsdRate {
  /** Decimal string, e.g. "50.85". */
  egpPerUsd: string;
  /** ISO timestamp. */
  setAt: string;
}

export interface PricingSettings {
  fulfillmentItems: FulfillmentItem[];
  /** Slider position: 0 = reach, 10000 = profit. */
  strategyBp: number;
  usdRate: UsdRate | null;
  guardrails: { minMarginBp: number; maxMarginBp: number };
  classes: Record<PriceKnowledge, ClassRule>;
  rounding: PriceRounding;
  staleDays: number;
  paybackOrders: number;
}

// ── Warnings ─────────────────────────────────────────────────────────────────

// Matches backend src/pricing/pricing-warnings.ts (`WARNING_KINDS`,
// `PricingWarning`, `WarningsResult`), as returned by `POST warnings/check`.

export type WarningKind =
  | 'LOSES_MONEY'
  | 'BELOW_LAW1'
  | 'THIN_MARGIN'
  | 'DISCOUNT_CAPPED'
  | 'CANT_COMPETE'
  | 'NO_COST'
  | 'NO_MARKET'
  | 'STALE_MARKET'
  | 'OFFER_BELOW_LAW1';

export interface PricingWarning {
  /** `${kind}:${variantId|'shop'}`. Stable; a PRICING notification goes out once per new key. */
  key: string;
  /** Known kinds are listed; the string fallback keeps a newer backend renderable. */
  kind: WarningKind | (string & {});
  /** Null for a shop-wide warning (OFFER_BELOW_LAW1). */
  variantId: string | null;
  productId: string | null;
  /** Plain English; also the notification title. */
  title: string;
  detail: string;
  /** DISCOUNT_CAPPED: the real discount; THIN_MARGIN: the margin. */
  valueBp?: number;
  /** OFFER_BELOW_LAW1: the number of products. */
  count?: number;
  /** Set warnings (backend#166): the set's bundle id. */
  bundleId?: string;
}

export interface PricingWarningsResult {
  /** Every item, shop-wide ones included: the yellow count. */
  total: number;
  /** Per-item warnings per product id; shop-wide warnings are not counted here. */
  byProduct: Record<string, number>;
  items: PricingWarning[];
}

// ── Rows ─────────────────────────────────────────────────────────────────────

/** Matches backend `CompetitorPriceRow` without `variantId` (as the overview sends it). */
export interface CompetitorPrice {
  id: string;
  source: string;
  url: string | null;
  priceMinor: number;
  /** ISO timestamp. */
  checkedAt: string;
}

/** The cost as entered. USD amounts are cents. */
export interface VariantCost {
  amountMinor: number | null;
  currency: CostCurrency | null;
  followsUsd: boolean;
  /** EGP per USD when a follows-the-dollar cost was entered, as a decimal string. */
  rateAtEntry: string | null;
}

/** Margin and profits at the price the shop charges now; all null without a cost. */
export interface CurrentEconomics {
  marginBp: number | null;
  markupBp: number | null;
  /** Price − cost − box & trip. */
  productProfitMinor: number | null;
  /** Product profit + the delivery fee. */
  orderProfitMinor: number | null;
}

/** Matches backend `OverviewVariantRow` (src/pricing/pricing.service.ts). */
export interface VariantRow {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  isActive: boolean;
  /** A variant with no pricing row reads as MANUAL with no cost. */
  mode: PricingMode;
  /** Null = not chosen yet; the engine reads it as KNOWN_BRAND. */
  priceKnowledge: PriceKnowledge | null;
  cost: VariantCost;
  /** Today's cost in piastres (USD and follows-the-dollar applied); null when unknown. */
  costMinor: number | null;
  competitorPrices: CompetitorPrice[];
  /** What the shop charges now. */
  currentPriceMinor: number;
  /** The engine's answer (floors, band, System price, flags, trace), whatever the mode. */
  system: PriceResult;
  /** The backend's own "why", generated from `system.trace`. */
  why: string;
  current: CurrentEconomics;
}

export type RunCause = 'STRATEGY' | 'RATE' | 'SETTINGS' | 'ITEM' | 'UNDO';

export interface PriceChangeSummary {
  variantId: string;
  /** Null for a variant created on System price: it had no price before. */
  oldPriceMinor: number | null;
  newPriceMinor: number;
}

/** Matches backend `RunSummary`. */
export interface RunSummary {
  id: string;
  cause: RunCause;
  changedCount: number;
  /** Mean of each change's (new − old) ÷ old; null when nothing changed. */
  averageChangeBp: number | null;
  createdAt: string;
  undoneAt: string | null;
  /** Present on write responses, omitted on `overview.lastRun`. */
  changes?: PriceChangeSummary[];
  /** Set prices the run changed (backend#166); on write responses. */
  setChanges?: { bundleId: string; oldPriceMinor: number; newPriceMinor: number }[];
}

/** Matches backend `PricingOverview`. */
export interface AccountingOverview {
  pricing: PricingSettings;
  fees: { fulfillmentMinor: number; deliveryFeeMinor: number };
  variants: VariantRow[];
  sets: SetRow[];
  lastRun: RunSummary | null;
  /** The run Undo would reverse right now, if any. */
  undoableRunId: string | null;
}

/** Every pricing write reprices live and answers with the run and a fresh overview. */
export interface RepriceResponse {
  run: RunSummary;
  overview: AccountingOverview;
}

export interface UndoResponse extends RepriceResponse {
  undoneRunId: string;
}

export interface CompetitorPriceResponse extends RepriceResponse {
  competitorPrice: CompetitorPrice & { variantId: string };
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export type PricingSettingsPatch = Partial<PricingSettings>;

/** Omitted keeps the stored value. A USD or follows-the-dollar cost needs the USD rate (400 otherwise). */
interface CostFields {
  costCurrency?: CostCurrency;
  /** EGP costs only. */
  followsUsd?: boolean;
}

/**
 * Body of `PUT variants/:id` (strict). System price needs a cost; My price
 * needs the price, and its cost is optional (omitted keeps it, null clears it).
 */
export type VariantPricingInput =
  | ({ mode: 'SYSTEM'; costAmountMinor: number } & CostFields)
  | ({ mode: 'MANUAL'; manualPriceMinor: number; costAmountMinor?: number | null } & CostFields);

export interface CompetitorPriceInput {
  /** 1–80 characters. */
  source: string;
  url?: string | null;
  /** At least 1. */
  priceMinor: number;
  checkedAt?: string;
}

/** The catalog's variant fields (no price: the engine sets it) plus the cost. */
export interface SystemVariantInput extends CostFields {
  sku?: string;
  /** Global variant id → free-typed value. */
  values?: Record<string, string>;
  /** Product-specific field name → value. */
  custom_values?: Record<string, string>;
  price_currency?: string;
  costAmountMinor: number;
}

/** `GET offers/impact` (backend src/pricing/pricing-warnings.ts `OfferImpact`). */
export interface OfferImpact {
  percentBp: number;
  productId: string | null;
  capped: {
    variantId: string;
    productId: string;
    productName: string;
    sku: string;
    priceMinor: number;
    offerPriceMinor: number;
    realPercentBp: number;
  }[];
  cappedProductCount: number;
  belowLaw1: { variantId: string; productId: string; offerPriceMinor: number }[];
  belowLaw1ProductCount: number;
}

// ── Growth ───────────────────────────────────────────────────────────────────

// Matches backend src/growth/growth.service.ts. Rates are fractions (0.1234),
// not basis points; every figure carries its `n`, and `lowData` is n < 20.

export type SpendChannel = 'META' | 'TIKTOK' | 'GOOGLE' | 'INFLUENCER' | 'OFFLINE' | 'OTHER';

/** Backend `ChannelRow`. */
export interface GrowthChannelRow {
  /** A spend channel (META …) or an analytics channel (PAID, SOCIAL, REFERRAL, DIRECT …). */
  channel: string;
  spendMinor: number;
  newCustomers: number;
  /** Spend ÷ new customers; null with spend and nobody acquired. */
  cacMinor: number | null;
  /** Average KNOWN first-order profit of this channel's new customers. */
  firstOrderProfit: { avgMinor: number | null; n: number; unknownN: number };
  /** CAC ÷ average known first-order profit; null when that is unknown or ≤ 0. */
  paybackOrders: number | null;
  /** CAC > first-order profit × settings.paybackOrders; null when profit is unknown. */
  leak: boolean | null;
  n: number;
  lowData: boolean;
}

export interface GrowthRate {
  n: number;
  /** count ÷ n, 4 decimals; null when n is 0. */
  rate: number | null;
  lowData: boolean;
}

/** Backend `GrowthReport`. */
export interface GrowthReport {
  period: { from: string; to: string };
  lowDataThreshold: number;
  /** settings.pricing.paybackOrders, the leak multiplier. */
  paybackOrders: number;
  orderProfit: {
    n: number;
    knownN: number;
    unknownN: number;
    totalMinor: number;
    avgMinor: number | null;
    negativeN: number;
    lowData: boolean;
  };
  delivery: {
    deliveryFeeMinor: number;
    fulfillmentMinor: number;
    surplusMinor: number;
    /** Percent (1 decimal) orders must rise for free delivery to break even. */
    freeDeliveryBreakEvenLiftPct: number | null;
    n: number;
    lowData: boolean;
  };
  channels: GrowthChannelRow[];
  newCustomers: { count: number; n: number; lowData: boolean };
  repeat: GrowthRate & { orders: number };
  refused: GrowthRate & { count: number };
  cancelled: GrowthRate & { count: number };
}

/** Backend `SpendView`. */
export interface SpendEntry {
  id: string;
  channel: SpendChannel;
  campaign: string;
  utmCampaign: string | null;
  discountCode: string | null;
  /** YYYY-MM-DD, inclusive. */
  spentFrom: string;
  spentTo: string;
  amountMinor: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** Body of `POST spend` (strict). Blank optional strings are stored as null. */
export interface SpendInput {
  channel: SpendChannel;
  /** 1–80 characters. */
  campaign: string;
  utmCampaign?: string | null;
  discountCode?: string | null;
  spentFrom: string;
  /** On or after `spentFrom`. */
  spentTo: string;
  /** Positive. */
  amountMinor: number;
  note?: string | null;
}

// ── Routes ───────────────────────────────────────────────────────────────────

const BASE = '/accounting';
const json = (body: unknown) => JSON.stringify(body);

export function apiAccountingOverview(): Promise<AccountingOverview> {
  return apiFetch(`${BASE}/overview`, { auth: true });
}

/**
 * The backend takes `{pricing: Partial<PricingSettings>}` and rejects any other
 * top-level key (422), so the slider can send `{strategyBp}` alone.
 */
export function apiUpdatePricingSettings(patch: PricingSettingsPatch): Promise<RepriceResponse> {
  return apiFetch(`${BASE}/settings`, { method: 'PATCH', auth: true, body: json({ pricing: patch }) });
}

/** 409 "prices were edited since" when a later change exists. */
export function apiUndoPricingRun(runId: string): Promise<UndoResponse> {
  return apiFetch(`${BASE}/runs/${encodeURIComponent(runId)}/undo`, { method: 'POST', auth: true });
}

/** System price (cost in) or My price (price in); reprices that variant live. */
export function apiUpdateVariantPricing(
  variantId: string,
  input: VariantPricingInput,
): Promise<RepriceResponse> {
  return apiFetch(`${BASE}/variants/${encodeURIComponent(variantId)}`, {
    method: 'PUT',
    auth: true,
    body: json(input),
  });
}

/** Null clears the choice (read as KNOWN_BRAND). Reprices the product's System-price variants. */
export function apiUpdateProductKnowledge(
  productId: string,
  knowledge: PriceKnowledge | null,
): Promise<RepriceResponse> {
  return apiFetch(`${BASE}/products/${encodeURIComponent(productId)}/knowledge`, {
    method: 'PUT',
    auth: true,
    body: json({ knowledge }),
  });
}

export function apiAddCompetitorPrice(
  variantId: string,
  input: CompetitorPriceInput,
): Promise<CompetitorPriceResponse> {
  return apiFetch(`${BASE}/variants/${encodeURIComponent(variantId)}/competitor-prices`, {
    method: 'POST',
    auth: true,
    body: json(input),
  });
}

export function apiDeleteCompetitorPrice(id: string): Promise<RepriceResponse> {
  return apiFetch(`${BASE}/competitor-prices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

/** Creates a variant on System price: cost in, computed price out. */
export function apiCreateSystemVariant(
  productId: string,
  input: SystemVariantInput,
): Promise<{ variant: Record<string, unknown>; run: RunSummary; overview: AccountingOverview }> {
  return apiFetch(`${BASE}/products/${encodeURIComponent(productId)}/variants`, {
    method: 'POST',
    auth: true,
    body: json(input),
  });
}

/** Also emits one PRICING notification per new warning key. */
export function apiCheckPricingWarnings(): Promise<PricingWarningsResult> {
  return apiFetch(`${BASE}/warnings/check`, { method: 'POST', auth: true });
}

export function apiOfferImpact(params: { percentBp: number; productId?: string }): Promise<OfferImpact> {
  const qs = new URLSearchParams({ percentBp: String(params.percentBp) });
  if (params.productId) qs.set('productId', params.productId);
  return apiFetch(`${BASE}/offers/impact?${qs.toString()}`, { auth: true });
}

/** `from`/`to` are local YYYY-MM-DD days, inclusive; omitted, the last 30 days ending today. */
export function apiGrowthReport(params: { from?: string; to?: string } = {}): Promise<GrowthReport> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const query = qs.toString();
  return apiFetch(`${BASE}/growth${query ? `?${query}` : ''}`, { auth: true });
}

export function apiListSpend(): Promise<SpendEntry[]> {
  return apiFetch(`${BASE}/spend`, { auth: true });
}

export function apiCreateSpend(input: SpendInput): Promise<SpendEntry> {
  return apiFetch(`${BASE}/spend`, { method: 'POST', auth: true, body: json(input) });
}

export function apiUpdateSpend(id: string, input: Partial<SpendInput>): Promise<SpendEntry> {
  return apiFetch(`${BASE}/spend/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    auth: true,
    body: json(input),
  });
}

export function apiDeleteSpend(id: string): Promise<void> {
  return apiFetch(`${BASE}/spend/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

// ── Sets (backend#166) ───────────────────────────────────────────────────────

/** One piece of a set, resolved the way the engine prices it. */
export interface SetMemberRow {
  productId: string;
  productName: string;
  /** Null when the member cannot be resolved (no active variant). */
  variantId: string | null;
  sku: string | null;
  quantity: number;
  unitPriceMinor: number | null;
  costMinor: number | null;
}

/** Matches backend `overview.sets[]`. */
export interface SetRow {
  bundleId: string;
  slug: string;
  name: string;
  isActive: boolean;
  mode: PricingMode;
  /** Stored saving; null = the default 10%. */
  savingBp: number | null;
  effectiveSavingBp: number;
  currentPriceMinor: number;
  members: SetMemberRow[];
  listTotalMinor: number | null;
  costMinor: number | null;
  /** Null when a member has no active variant. */
  system: PriceResult | null;
  why: string;
  current: CurrentEconomics;
  /** Keys are `KIND:<bundleId>`, with `bundleId` set. */
  warnings: PricingWarning[];
}

/**
 * Body of `PUT sets/:id`. An omitted `savingBp` keeps the stored one; null
 * restores the default 10%.
 */
export type SetPricingInput =
  | { mode: 'SYSTEM'; savingBp?: number | null }
  | { mode: 'MANUAL'; manualPriceMinor: number; savingBp?: number | null };

/** Prices one set on System price (members less the saving) or My price. 422 invalid, 404 unknown. */
export function apiUpdateSetPricing(bundleId: string, input: SetPricingInput): Promise<RepriceResponse> {
  return apiFetch(`${BASE}/sets/${encodeURIComponent(bundleId)}`, {
    method: 'PUT',
    auth: true,
    body: json(input),
  });
}
