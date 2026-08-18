import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Supabase returns its auth errors in English. Agencies in Conakry work in
 * French, so match on the message and hand back our own wording, falling back
 * to a generic line rather than showing a raw API string.
 */
export function authErrorMessage(raw: string, t: Dictionary): string {
  const e = t.auth.errors;
  const m = raw.toLowerCase();

  if (raw === "confirm-email") return e.confirmEmail;
  if (m.includes("invalid login credentials")) return e.invalid;
  if (m.includes("email not confirmed")) return e.notConfirmed;
  if (m.includes("already registered") || m.includes("already been registered")) {
    return e.alreadyRegistered;
  }
  if (m.includes("password should be")) return e.weakPassword;
  if (m.includes("rate limit") || m.includes("too many requests")) return e.rateLimit;
  if (m.includes("fetch failed") || m.includes("network")) return e.unreachable;
  return e.generic;
}
