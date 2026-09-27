/** Canonical Egyptian mobile storage matches storefront signup: +20 + national digits. */
export function normalizeAssistedPhone(input: string): string | null {
  let digits = input.trim().replace(/[\s().-]/g, '');
  if (digits.startsWith('+20')) digits = digits.slice(3);
  else if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^1[0125]\d{8}$/.test(digits) ? `+20${digits}` : null;
}

export function assistedPhoneLocal(input: string): string {
  return normalizeAssistedPhone(input)?.slice(3) ?? input;
}
