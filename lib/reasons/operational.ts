export const INVENTORY_ADJUSTMENT_REASONS = [
  { value: 'STOCK_COUNT', label: 'Stock count' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'CORRECTION', label: 'Correction' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const CUSTOMER_TIER_REASONS = [
  { value: 'MANUAL_REVIEW', label: 'Manual review' },
  { value: 'LOYALTY_REWARD', label: 'Loyalty reward' },
  { value: 'SERVICE_RECOVERY', label: 'Service recovery' },
  { value: 'ACCOUNT_CORRECTION', label: 'Account correction' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const COLLABORATOR_REJECTION_REASONS = [
  { value: 'IMAGE_QUALITY', label: 'Image quality' },
  { value: 'MISSING_DETAILS', label: 'Missing details' },
  { value: 'PRICING', label: 'Pricing' },
  { value: 'POLICY', label: 'Policy' },
  { value: 'OUT_OF_SCOPE', label: 'Out of scope' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const DISCOUNT_REASONS = [
  { value: 'CAMPAIGN', label: 'Campaign' },
  { value: 'CUSTOMER_RECOVERY', label: 'Customer recovery' },
  { value: 'CLEARANCE', label: 'Clearance' },
  { value: 'PARTNER_PROMOTION', label: 'Partner promotion' },
  { value: 'TESTING', label: 'Testing' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type InventoryAdjustmentReason = typeof INVENTORY_ADJUSTMENT_REASONS[number]['value'];
export type CustomerTierReason = typeof CUSTOMER_TIER_REASONS[number]['value'];
export type CollaboratorRejectionReason = typeof COLLABORATOR_REJECTION_REASONS[number]['value'];
export type DiscountReason = typeof DISCOUNT_REASONS[number]['value'];

/**
 * Legacy endpoints still have one text column rather than reasonCode +
 * reasonNote. Keep their stored value readable until those backend contracts
 * become structured: a known choice stores its label, while Other stores the
 * required explanation itself.
 */
export function legacyReasonText<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  value: T,
  note: string,
): string {
  if (value === 'OTHER') return note.trim();
  return options.find((option) => option.value === value)?.label ?? value;
}
