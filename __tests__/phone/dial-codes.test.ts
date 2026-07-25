import {
  DEFAULT_DIAL_CODE,
  phoneProblem,
  splitE164,
  toE164,
} from '@/lib/phone/dial-codes';

/**
 * The dashboard edits phone numbers a customer may have set at sign-up, so both
 * sides must agree exactly. splitE164 is the risky half: getting it wrong would
 * silently rewrite a stored number the moment an admin opened the form and saved.
 */
describe('splitE164', () => {
  it('splits an Egyptian number into its country and local part', () => {
    expect(splitE164('+201012431350')).toEqual({ dial: '+20', national: '1012431350' });
  });

  it('prefers the longest matching dial code', () => {
    // +20 is a prefix of nothing here, but +971 must not be read as +97 or +9.
    expect(splitE164('+971501234567')).toEqual({ dial: '+971', national: '501234567' });
    // +966 (9 digits) rather than +9 or +96.
    expect(splitE164('+966501234567')).toEqual({ dial: '+966', national: '501234567' });
  });

  it('round-trips through toE164 unchanged', () => {
    for (const stored of [
      '+201012431350',
      '+447700900123',
      '+966501234567',
      '+971501234567',
    ]) {
      const { dial, national } = splitE164(stored);
      expect(toE164(dial, national)).toBe(stored);
    }
  });

  it('falls back to the default country for an empty or unrecognised value', () => {
    expect(splitE164('')).toEqual({ dial: DEFAULT_DIAL_CODE, national: '' });
    expect(splitE164(null)).toEqual({ dial: DEFAULT_DIAL_CODE, national: '' });
    expect(splitE164(undefined)).toEqual({ dial: DEFAULT_DIAL_CODE, national: '' });
  });

  it('keeps the digits when the shape is not recognised, rather than dropping them', () => {
    // Deliberately nonsense: whatever happens, no digits may be lost silently.
    const { national } = splitE164('+999123');
    expect(national).toContain('123');
  });
});

describe('the dashboard applies the same rules as signup', () => {
  it('drops the trunk zero', () => {
    expect(toE164('+20', '01012431350')).toBe('+201012431350');
  });

  it('rejects a wrong length for the chosen country', () => {
    expect(phoneProblem('+20', '0101243135')).toMatch(/10 digits/);
    expect(phoneProblem('+20', '01012431350')).toBeNull();
  });
});
