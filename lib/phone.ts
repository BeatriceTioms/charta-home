/**
 * Phone numbers, on the way into the database.
 *
 * Postgres stores them in E.164 and enforces it: `+` then digits, nothing
 * else. The interface, quite rightly, shows them the way a person reads them,
 * "+224 620 14 22 31", and the forms even suggest that shape in their
 * placeholder. Typing what the placeholder shows then failed the insert with
 * the name of a check constraint, which is the application telling somebody
 * off for following its own instructions.
 *
 * So the spacing is a display concern in both directions, and this is where it
 * gets undone.
 */

/** Guinea. Used only when a number is typed without any country code. */
const DEFAULT_DIALLING_CODE = "224";

/** National number lengths that look like a bare local number, per country. */
const LOCAL_LENGTHS = new Set([8, 9, 10]);

/**
 * Turns whatever was typed into E.164, or returns "" if it cannot be read as
 * a number at all. Blank input gives back blank: a resident without a phone
 * is allowed, and inventing one would be worse than storing nothing.
 *
 * Accepts the shapes people actually type: spaces, dots and dashes as
 * grouping, parentheses around an area code, `00` for the international
 * prefix, and a bare local number.
 */
export function toE164(input: string, diallingCode = DEFAULT_DIALLING_CODE): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  // Keep only what a number can be made of, and note whether it was written
  // as international before the punctuation goes.
  const hadPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // 00 is how the international prefix is dialled across francophone Africa
  // and Europe alike, and means the same thing as a leading +.
  if (!hadPlus && digits.startsWith("00")) digits = digits.slice(2);
  else if (!hadPlus && LOCAL_LENGTHS.has(digits.length) && !digits.startsWith(diallingCode)) {
    // A bare local number, so it belongs to the agency's own country. A
    // leading 0 is a national trunk prefix and is dropped by E.164.
    digits = diallingCode + digits.replace(/^0+/, "");
  }

  // E.164 allows at most fifteen digits, and no country code starts with zero.
  digits = digits.replace(/^0+/, "");
  if (digits.length < 7 || digits.length > 15) return "";

  return `+${digits}`;
}

/**
 * Whether a value will satisfy the database's own check. Kept next to the
 * normaliser so the two cannot drift: this is the same expression the column
 * carries.
 */
export function isE164(value: string): boolean {
  return /^\+[1-9][0-9]{6,14}$/.test(value);
}
