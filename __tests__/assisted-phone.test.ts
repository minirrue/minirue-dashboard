import { assistedPhoneLocal, normalizeAssistedPhone } from '@/lib/orders/assisted-phone';

test.each(['01012431350', '1012431350', '+201012431350', '201012431350', '00201012431350', '010 1243 1350'])('normalizes %s into the shared signup identity', input => {
  expect(normalizeAssistedPhone(input)).toBe('+201012431350');
  expect(assistedPhoneLocal(input)).toBe('1012431350');
});
test.each(['', '01012', '+441012431350', '001012431350', '01312431350', 'abc01012431350'])('rejects invalid mobile %s', input => {
  expect(normalizeAssistedPhone(input)).toBeNull();
});
