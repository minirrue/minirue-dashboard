/**
 * Country dial codes and phone normalisation, shared with the storefront signup
 * form (apps/minirue-frontend/lib/auth/dial-codes.ts) — kept identical on purpose.
 *
 * Editing a customer's phone in the dashboard was a plain text box with no country,
 * so it accepted values signup would reject and could store a number that is not
 * E.164. Same rules on both sides means an admin correction and a customer's own
 * sign-up produce the same stored value.
 *
 * Deliberately not the full ISO 3166 list: this is a select a shopper reads,
 * and 250 entries make it unusable. Egypt is first because it is the home
 * market, then the rest of the shipping region and the countries the customer
 * base actually comes from, alphabetically.
 */
export interface DialCode {
  /** ISO 3166-1 alpha-2 — also what the address book stores as countryCode. */
  code: string;
  name: string;
  dial: string;
  /**
   * How many digits the national number has once the trunk zero is dropped.
   * Egyptian mobiles are 10 (1XXXXXXXXX), typed either as 01XXXXXXXXX or
   * 1XXXXXXXXX — both must end up as the same +20 number, and anything that is
   * not one of these lengths is a typo we should catch before signup, not after
   * a courier cannot reach the customer. Omitted where the length genuinely
   * varies; those countries fall back to a 6–14 digit sanity range.
   */
  digits?: number[];
}

export const DIAL_CODES: DialCode[] = [
  { code: 'EG', name: 'Egypt', dial: '+20', digits: [10] },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', digits: [9] },
  { code: 'BH', name: 'Bahrain', dial: '+973', digits: [8] },
  { code: 'DZ', name: 'Algeria', dial: '+213', digits: [9] },
  { code: 'IQ', name: 'Iraq', dial: '+964', digits: [10] },
  { code: 'JO', name: 'Jordan', dial: '+962', digits: [9] },
  { code: 'KW', name: 'Kuwait', dial: '+965', digits: [8] },
  { code: 'LB', name: 'Lebanon', dial: '+961', digits: [7, 8] },
  { code: 'LY', name: 'Libya', dial: '+218', digits: [9] },
  { code: 'MA', name: 'Morocco', dial: '+212', digits: [9] },
  { code: 'OM', name: 'Oman', dial: '+968', digits: [8] },
  { code: 'PS', name: 'Palestine', dial: '+970', digits: [9] },
  { code: 'QA', name: 'Qatar', dial: '+974', digits: [8] },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', digits: [9] },
  { code: 'SD', name: 'Sudan', dial: '+249', digits: [9] },
  { code: 'SY', name: 'Syria', dial: '+963', digits: [9] },
  { code: 'TN', name: 'Tunisia', dial: '+216', digits: [8] },
  { code: 'TR', name: 'Türkiye', dial: '+90', digits: [10] },
  { code: 'YE', name: 'Yemen', dial: '+967', digits: [9] },
  { code: 'AU', name: 'Australia', dial: '+61', digits: [9] },
  { code: 'AT', name: 'Austria', dial: '+43', digits: [10, 11] },
  { code: 'BE', name: 'Belgium', dial: '+32', digits: [9] },
  { code: 'CA', name: 'Canada', dial: '+1', digits: [10] },
  { code: 'CN', name: 'China', dial: '+86', digits: [11] },
  { code: 'DK', name: 'Denmark', dial: '+45', digits: [8] },
  { code: 'FR', name: 'France', dial: '+33', digits: [9] },
  { code: 'DE', name: 'Germany', dial: '+49', digits: [10, 11] },
  { code: 'GR', name: 'Greece', dial: '+30', digits: [10] },
  { code: 'IN', name: 'India', dial: '+91', digits: [10] },
  { code: 'ID', name: 'Indonesia', dial: '+62', digits: [9, 10, 11] },
  { code: 'IE', name: 'Ireland', dial: '+353', digits: [9] },
  { code: 'IT', name: 'Italy', dial: '+39', digits: [9, 10] },
  { code: 'JP', name: 'Japan', dial: '+81', digits: [10] },
  { code: 'KE', name: 'Kenya', dial: '+254', digits: [9] },
  { code: 'MY', name: 'Malaysia', dial: '+60', digits: [9, 10] },
  { code: 'NL', name: 'Netherlands', dial: '+31', digits: [9] },
  { code: 'NG', name: 'Nigeria', dial: '+234', digits: [10] },
  { code: 'NO', name: 'Norway', dial: '+47', digits: [8] },
  { code: 'PK', name: 'Pakistan', dial: '+92', digits: [10] },
  { code: 'PH', name: 'Philippines', dial: '+63', digits: [10] },
  { code: 'PL', name: 'Poland', dial: '+48', digits: [9] },
  { code: 'PT', name: 'Portugal', dial: '+351', digits: [9] },
  { code: 'RO', name: 'Romania', dial: '+40', digits: [9] },
  { code: 'RU', name: 'Russia', dial: '+7', digits: [10] },
  { code: 'SG', name: 'Singapore', dial: '+65', digits: [8] },
  { code: 'ZA', name: 'South Africa', dial: '+27', digits: [9] },
  { code: 'ES', name: 'Spain', dial: '+34', digits: [9] },
  { code: 'SE', name: 'Sweden', dial: '+46', digits: [7, 8, 9] },
  { code: 'CH', name: 'Switzerland', dial: '+41', digits: [9] },
  { code: 'GB', name: 'United Kingdom', dial: '+44', digits: [10] },
  { code: 'US', name: 'United States', dial: '+1', digits: [10] },
];

export const DEFAULT_DIAL_CODE = '+20';

/** First country matching a dial code. +1 is shared, but US and CA agree on 10. */
export function countryForDial(dial: string): DialCode | undefined {
  return DIAL_CODES.find((c) => c.dial === dial);
}

/**
 * The national significant number: digits only, trunk zero removed, and the dial
 * code stripped if the shopper typed it again.
 *
 * This is the whole edge case. `01012431350` and `1012431350` are the same
 * Egyptian mobile, and so is `+201012431350` and `201012431350` — all four have
 * to reduce to `1012431350`, or the first would be stored as `+2001012431350`
 * and the number would be undialable.
 */
export function nationalNumber(dial: string, input: string): string {
  const dialDigits = dial.replace(/\D/g, '');
  // Leading zeros go first, which covers both the national trunk zero (0101…)
  // and the international prefix (00201…) — strip the dial code before this and
  // the 00 form would sail past the check below and get prefixed twice.
  let digits = input.replace(/\D/g, '').replace(/^0+/, '');

  // Typed the dial code into the number field as well ("+20 100…", "20100…").
  // Only strip it when what remains is a length this country actually uses, so a
  // national number that merely begins with the same digits survives.
  if (digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
    const rest = digits.slice(dialDigits.length).replace(/^0+/, '');
    const expected = countryForDial(dial)?.digits;
    const plausible = expected
      ? expected.includes(rest.length)
      : rest.length >= 6;
    if (plausible) digits = rest;
  }

  return digits.replace(/^0+/, '');
}

/** E.164 — what the API stores. */
export function toE164(dial: string, input: string): string {
  return `${dial}${nationalNumber(dial, input)}`;
}

/**
 * Null when the number is usable, otherwise why not. Country-specific when we
 * know the length, a loose sanity range otherwise.
 */
export function phoneProblem(dial: string, input: string): string | null {
  const national = nationalNumber(dial, input);
  if (!national) return 'Phone number is required';
  if (!/^\d+$/.test(national)) return 'Digits only';

  const country = countryForDial(dial);
  const expected = country?.digits;
  if (expected && !expected.includes(national.length)) {
    const list =
      expected.length === 1
        ? `${expected[0]} digits`
        : `${expected.slice(0, -1).join(', ')} or ${expected[expected.length - 1]} digits`;
    return `A ${country.name} number has ${list} after the leading zero — you entered ${national.length}`;
  }
  if (!expected && (national.length < 6 || national.length > 14)) {
    return 'Enter a valid phone number';
  }
  return null;
}


/**
 * Splits a stored E.164 number back into a dial code and a local number, so the
 * edit form opens with the country already selected instead of making an admin
 * re-pick it (and risk changing it by accident).
 *
 * Longest dial code first: +20 would otherwise swallow +201-prefixed matches, and
 * +1 would claim every North American number ahead of nothing else.
 */
export function splitE164(value: string | null | undefined): {
  dial: string;
  national: string;
} {
  const raw = (value ?? '').trim();
  if (!raw) return { dial: DEFAULT_DIAL_CODE, national: '' };

  const digits = raw.replace(/\D/g, '');
  const byLongestDial = [...DIAL_CODES].sort(
    (a, b) => b.dial.length - a.dial.length,
  );

  for (const country of byLongestDial) {
    const dialDigits = country.dial.replace(/\D/g, '');
    if (!digits.startsWith(dialDigits)) continue;
    const rest = digits.slice(dialDigits.length);
    // Only accept the split when what remains is a length this country uses;
    // otherwise a coincidental prefix would mangle the number.
    const expected = country.digits;
    if (expected ? expected.includes(rest.length) : rest.length >= 6) {
      return { dial: country.dial, national: rest };
    }
  }

  // Unrecognised shape — show it as typed under the default country rather than
  // silently dropping digits.
  return { dial: DEFAULT_DIAL_CODE, national: digits };
}
