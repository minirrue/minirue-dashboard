import type { DeliveryConfig } from '@/lib/api/settings';

/**
 * Client-side mirror of the backend's `DeliveryConfigSchema` refinements
 * (minirue-backend `src/settings/dto/update-settings.dto.ts`, dashboard#84 /
 * backend#186's pinned contract) — so the Delivery settings form can reject a
 * bad save before the round trip, with the same rules the server enforces.
 *
 * Deliberately NOT the whole schema (field lengths, HH:mm regex, etc.) —
 * those are covered by ordinary input constraints in the form; this covers
 * the two cross-field rules a plain input cannot express.
 */
export interface DeliveryValidationError {
  field: 'windowStart' | 'windowEnd' | 'cutoff' | 'feeMin' | 'feeMax' | 'governorates' | 'disclaimer' | 'etaLabel';
  message: string;
}

function timeToMinutes(value: string): number | null {
  if (value === '24:00') return 24 * 60;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Validates the `sameDay` half of the delivery block. Returns every
 * violation found, not just the first — the form shows them all at once.
 */
export function validateSameDayDelivery(
  sameDay: DeliveryConfig['sameDay'],
): DeliveryValidationError[] {
  const errors: DeliveryValidationError[] = [];

  const start = timeToMinutes(sameDay.windowStart);
  const end = timeToMinutes(sameDay.windowEnd);
  const cutoff = timeToMinutes(sameDay.cutoff);

  if (start === null) errors.push({ field: 'windowStart', message: 'Must be HH:mm' });
  if (end === null) errors.push({ field: 'windowEnd', message: "Must be HH:mm or '24:00'" });
  if (cutoff === null) errors.push({ field: 'cutoff', message: 'Must be HH:mm' });

  if (start !== null && end !== null && start > end) {
    errors.push({ field: 'windowStart', message: 'Window start must be at or before window end' });
  }

  // Owner correction on backend#186: the cutoff must leave at least an hour
  // of window after it — the shop never promises a same-day shipment inside
  // the last 60 minutes of its own delivery slot.
  if (cutoff !== null && end !== null && cutoff > end - 60) {
    errors.push({
      field: 'cutoff',
      message: 'Cut-off must be at least 60 minutes before the window ends',
    });
  }

  if (sameDay.feeRangeMinor.min > sameDay.feeRangeMinor.max) {
    errors.push({ field: 'feeMin', message: 'Minimum fee must be at or below the maximum' });
  }
  if (sameDay.feeRangeMinor.min < 0) {
    errors.push({ field: 'feeMin', message: 'Fee cannot be negative' });
  }

  if (sameDay.governorates.length === 0) {
    errors.push({ field: 'governorates', message: 'Choose at least one governorate' });
  }

  if (sameDay.disclaimer.trim().length === 0) {
    errors.push({ field: 'disclaimer', message: 'Disclaimer cannot be empty' });
  }

  return errors;
}

export function validateDeliverySettings(delivery: DeliveryConfig): DeliveryValidationError[] {
  const errors: DeliveryValidationError[] = [];
  if (delivery.standard.etaLabel.trim().length === 0) {
    errors.push({ field: 'etaLabel', message: 'ETA label cannot be empty' });
  }
  return [...errors, ...validateSameDayDelivery(delivery.sameDay)];
}
