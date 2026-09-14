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

export type WarningKind =
  | 'LOSES_MONEY'
  | 'BELOW_LAW1'
  | 'DISCOUNT_CAPPED'
  | 'CANT_COMPETE'
  | 'THIN_MARGIN'
  | 'NO_COST'
  | 'NO_MARKET'
  | 'STALE_MARKET'
  | 'OFFER_BELOW_LAW1';

export interface Warning {
  /** Stable identity; notifications are emitted once per new key. */
  key: string;
  /** Known kinds are listed; the string fallback keeps a newer backend renderable. */
  kind: WarningKind | (string & {});
  title: string;
  detail: string;
  productId?: string;
  variantId?: string;
  bundleId?: string;
  /** Dashboard path that opens the offending row. */
  link: string;
}

export interface WarningSummary {
  total: number;
  byProduct: Record<string, number>;
  items: Warning[];
}

// ── Rows ─────────────────────────────────────────────────────────────────────

export interface CompetitorPrice {
  id: string;
  source: string;
  url: string | null;
  priceMinor: number;
  checkedAt: string;
}

export interface VariantRow {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sku: string | null;
  mode: PricingMode;
  costAmountMinor: number | null;
  costCurrency: CostCurrency | null;
  followsUsd: boolean;
  knowledge: PriceKnowledge;
  competitorPrices: CompetitorPrice[];
  livePriceMinor: number;
  /** Null when the engine cannot price it (no cost). */
  result: PriceResult | null;
  warnings: Warning[];
}

export interface SetRow {
  bundleId: string;
  bundleName: string;
  mode: PricingMode;
  /** Saving off the members' prices, default 1000 (10%). */
  savingBp: number;
  livePriceMinor: number;
  result: PriceResult | null;
  warnings: Warning[];
}

export interface RunSummary {
  runId: string;
  cause: string;
  changedCount: number;
  avgChangeBp: number;
  undoable: boolean;
  createdAt: string;
}

export interface AccountingOverview {
  settings: PricingSettings;
  variants: VariantRow[];
  sets: SetRow[];
  lastRun: RunSummary | null;
}

/** Every pricing write reprices live and answers with the run and a fresh overview. */
export interface RepriceResponse {
  run: RunSummary;
  overview: AccountingOverview;
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export type PricingSettingsPatch = Partial<PricingSettings>;

export interface VariantPricingInput {
  mode?: PricingMode;
  costAmountMinor?: number | null;
  costCurrency?: CostCurrency | null;
  followsUsd?: boolean;
  /** My price; only meaningful in MANUAL mode. */
  priceMinor?: number;
}

export interface SetPricingInput {
  mode?: PricingMode;
  savingBp?: number;
  priceMinor?: number;
}

export interface CompetitorPriceInput {
  source: string;
  url?: string | null;
  priceMinor: number;
  checkedAt?: string;
}

export interface SystemVariantInput {
  label: string;
  sku?: string | null;
  costAmountMinor: number;
  costCurrency: CostCurrency;
  followsUsd?: boolean;
  [attribute: string]: unknown;
}

export interface OfferImpact {
  cappedCount: number;
  capped: { productId: string; variantId: string; productName: string; offerPriceMinor: number }[];
  belowLaw1Count: number;
}

// ── Growth ───────────────────────────────────────────────────────────────────

export interface GrowthChannel {
  channel: string;
  campaign: string | null;
  spendMinor: number;
  newCustomers: number;
  /** Null when there are no new customers to divide by. */
  cacMinor: number | null;
  avgFirstOrderProfitMinor: number | null;
  /** CAC ÷ average first-order profit, in orders. */
  paybackOrders: number | null;
  /** CAC exceeds first-order profit. */
  leak: boolean;
  lowData: boolean;
}

export interface GrowthReport {
  from: string;
  to: string;
  orders: {
    n: number;
    /** Null when any line's cost is unknown. */
    profitMinor: number | null;
    unknownProfitCount: number;
    lowData: boolean;
  };
  delivery: {
    feeMinor: number;
    boxAndTripMinor: number;
    surplusPerOrderMinor: number;
    /** Orders would need to rise by this much for free delivery to break even. */
    freeDeliveryBreakEvenBp: number | null;
  };
  channels: GrowthChannel[];
  repeatRateBp: number | null;
  refusedRateBp: number | null;
}

export interface SpendEntry {
  id: string;
  channel: string;
  campaign: string;
  utmCampaign: string | null;
  discountCode: string | null;
  startsOn: string;
  endsOn: string;
  amountMinor: number;
  createdAt: string;
}

export type SpendInput = Omit<SpendEntry, 'id' | 'createdAt'>;

// ── Routes ───────────────────────────────────────────────────────────────────

const BASE = '/accounting';
const json = (body: unknown) => JSON.stringify(body);

export function apiAccountingOverview(): Promise<AccountingOverview> {
  return apiFetch(`${BASE}/overview`, { auth: true });
}

export function apiUpdatePricingSettings(patch: PricingSettingsPatch): Promise<RepriceResponse> {
  return apiFetch(`${BASE}/settings`, { method: 'PATCH', auth: true, body: json(patch) });
}

/** 409 "prices were edited since" when a later change exists. */
export function apiUndoPricingRun(runId: string): Promise<RepriceResponse> {
  return apiFetch(`${BASE}/runs/${encodeURIComponent(runId)}/undo`, { method: 'POST', auth: true });
}

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

export function apiUpdateProductKnowledge(
  productId: string,
  knowledge: PriceKnowledge,
): Promise<RepriceResponse> {
  return apiFetch(`${BASE}/products/${encodeURIComponent(productId)}/knowledge`, {
    method: 'PUT',
    auth: true,
    body: json({ knowledge }),
  });
}

export function apiUpdateSetPricing(bundleId: string, input: SetPricingInput): Promise<RepriceResponse> {
  return apiFetch(`${BASE}/sets/${encodeURIComponent(bundleId)}`, {
    method: 'PUT',
    auth: true,
    body: json(input),
  });
}

export function apiAddCompetitorPrice(
  variantId: string,
  input: CompetitorPriceInput,
): Promise<RepriceResponse> {
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
): Promise<{ variant: VariantRow; run: RunSummary }> {
  return apiFetch(`${BASE}/products/${encodeURIComponent(productId)}/variants`, {
    method: 'POST',
    auth: true,
    body: json(input),
  });
}

/** Also emits one PRICING notification per new warning key. */
export function apiCheckPricingWarnings(): Promise<WarningSummary> {
  return apiFetch(`${BASE}/warnings/check`, { method: 'POST', auth: true });
}

export function apiOfferImpact(params: { percentBp: number; productId?: string }): Promise<OfferImpact> {
  const qs = new URLSearchParams({ percentBp: String(params.percentBp) });
  if (params.productId) qs.set('productId', params.productId);
  return apiFetch(`${BASE}/offers/impact?${qs.toString()}`, { auth: true });
}

export function apiGrowthReport(params: { from: string; to: string }): Promise<GrowthReport> {
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  return apiFetch(`${BASE}/growth?${qs.toString()}`, { auth: true });
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
