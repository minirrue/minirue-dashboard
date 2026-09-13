/**
 * The name an admin gives a discount code, as the backend will store it.
 *
 * MIRRORS `normaliseAdminCode` in minirue-backend `src/discounts/discount-code.util.ts`
 * (backend#103). The server is the authority — it normalises again and enforces
 * uniqueness — but the form shows this live so the admin sees exactly the code
 * that will be saved and printed, not what they happened to type.
 *
 * - UPPERCASE, punctuation dropped, whitespace runs collapsed to one space
 * - 3-24 letters or digits (spaces do not count), at most 32 characters shown
 *
 * Shoppers are matched ignoring spaces, so `SUMMER SALE` also accepts
 * `summersale` — and for the same reason a second code `SUMMERSALE` cannot be
 * created beside it.
 */

export const CODE_NAME_MIN_KEY = 3;
export const CODE_NAME_MAX_KEY = 24;
export const CODE_NAME_MAX_DISPLAY = 32;

export function formatCodeName(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** What is wrong with a name, in words for the form — or null when it is fine. */
export function codeNameProblem(input: string): string | null {
  const display = formatCodeName(input);
  const key = display.replace(/ /g, '');
  if (key.length < CODE_NAME_MIN_KEY) {
    return `Use at least ${CODE_NAME_MIN_KEY} letters or digits.`;
  }
  if (key.length > CODE_NAME_MAX_KEY) {
    return `Use at most ${CODE_NAME_MAX_KEY} letters or digits.`;
  }
  if (display.length > CODE_NAME_MAX_DISPLAY) {
    return `Too long with its spaces — keep it to ${CODE_NAME_MAX_DISPLAY} characters.`;
  }
  return null;
}
