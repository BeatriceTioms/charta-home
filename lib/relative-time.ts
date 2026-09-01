/**
 * How long ago something happened, in the reader's language.
 *
 * Pure, and takes `now` rather than reading the clock, for two reasons: the
 * component that calls it has to render once on the server and again in the
 * browser from two different clocks, and a function that reads the clock
 * cannot be checked at its boundaries.
 *
 * Anything older than a week comes back as a date. "37 days ago" is arithmetic
 * the reader has to undo; "2 August" is the thing they wanted.
 */
export function relativeLabel(at: string, now: number, tag: "fr-FR" | "en-GB"): string {
  const then = Date.parse(at);
  if (Number.isNaN(then)) return "";

  const elapsed = now - then;
  // A clock a few seconds behind the row that was just written should not
  // produce "in 3 seconds".
  if (elapsed < 0) return relativeLabel(at, then, tag);

  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });

  // Seconds rather than minutes below the minute: zero minutes reads as
  // "cette minute-ci", where zero seconds reads as "maintenant".
  if (elapsed < 60_000) return rtf.format(0, "second");

  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) return rtf.format(-minutes, "minute");

  const hours = Math.round(elapsed / 3_600_000);
  if (hours < 24) return rtf.format(-hours, "hour");

  const days = Math.round(elapsed / 86_400_000);
  if (days < 7) return rtf.format(-days, "day");

  return absoluteLabel(at, tag);
}

/** Just the day. What is shown before the browser has a clock of its own. */
export function absoluteLabel(at: string, tag: "fr-FR" | "en-GB"): string {
  const then = Date.parse(at);
  if (Number.isNaN(then)) return "";
  return new Date(then).toLocaleDateString(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** The same moment written out in full, for the tooltip. */
export function exactLabel(at: string, tag: "fr-FR" | "en-GB"): string {
  const then = Date.parse(at);
  if (Number.isNaN(then)) return "";
  return new Date(then).toLocaleString(tag, { dateStyle: "long", timeStyle: "short" });
}
