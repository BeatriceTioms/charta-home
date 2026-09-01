/**
 * Charta Home · the recent activity card
 *
 * Every line of this card used to be invented. The events were assembled from
 * whatever happened to be lying in the arrays the page had already loaded: any
 * flat whose rent was paid became "rent received", any resolved ticket became
 * the second row, and the last flat in the list became "lease renewed" for a
 * lease nobody had renewed. The three times were constants in the dictionary,
 * so `hoursAgo: "il y a 2 heures"` was printed under a payment recorded in
 * March and read the same in September.
 *
 * So this checks two separate things: that the wording is right at each
 * boundary, and that the data is still coming from records rather than from
 * whatever is convenient.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { absoluteLabel, exactLabel, relativeLabel } from "../lib/relative-time.ts";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const read = (...p) => readFile(path.join(process.cwd(), ...p), "utf8");

/* ------------------------------------------------------------ the words --
 * A fixed reference moment, so these read the same in a year. Nothing here
 * calls the clock; that is the point of the function taking `now`.
 */
const NOW = Date.parse("2026-09-01T12:00:00Z");
const ago = (ms) => new Date(NOW - ms).toISOString();

const cases = [
  ["under a minute", 30_000, "maintenant", "now"],
  ["minutes", 5 * 60_000, "il y a 5 minutes", "5 minutes ago"],
  ["hours", 2 * 3_600_000, "il y a 2 heures", "2 hours ago"],
  ["a day", 86_400_000, "hier", "yesterday"],
  ["days", 3 * 86_400_000, "il y a 3 jours", "3 days ago"],
];
for (const [label, ms, fr, en] of cases) {
  const gotFr = relativeLabel(ago(ms), NOW, "fr-FR");
  const gotEn = relativeLabel(ago(ms), NOW, "en-GB");
  check(`${label} reads naturally in both languages`,
    gotFr === fr && gotEn === en, `${gotFr} / ${gotEn}`);
}

// A week is the point where counting stops helping.
const old = relativeLabel(ago(40 * 86_400_000), NOW, "fr-FR");
check("anything older than a week is a date, not a count",
  /2026/.test(old) && !/il y a/.test(old), old);

check("a week ago is already a date",
  !/il y a/.test(relativeLabel(ago(8 * 86_400_000), NOW, "fr-FR")),
  relativeLabel(ago(8 * 86_400_000), NOW, "fr-FR"));
check("six days ago is still counted",
  /il y a 6 jours/.test(relativeLabel(ago(6 * 86_400_000), NOW, "fr-FR")),
  relativeLabel(ago(6 * 86_400_000), NOW, "fr-FR"));

/* The server renders before the browser has a clock, and the two clocks are
 * never identical. Neither case may produce a wrong word.
 */
check("a row written a moment in the future does not read as the future",
  !/dans/.test(relativeLabel(new Date(NOW + 3_000).toISOString(), NOW, "fr-FR")),
  relativeLabel(new Date(NOW + 3_000).toISOString(), NOW, "fr-FR"));
check("the first paint is a plain date, which no clock disagrees about",
  absoluteLabel(ago(2 * 3_600_000), "fr-FR") === "1 septembre 2026",
  absoluteLabel(ago(2 * 3_600_000), "fr-FR"));
check("the exact moment is available for the tooltip",
  /12:00|13:00|11:00/.test(exactLabel("2026-09-01T12:00:00Z", "fr-FR")),
  exactLabel("2026-09-01T12:00:00Z", "fr-FR"));
check("a timestamp that will not parse renders nothing rather than NaN",
  relativeLabel("not a date", NOW, "fr-FR") === "" &&
  absoluteLabel("not a date", "fr-FR") === "",
  "no Invalid Date on the dashboard");

/* ------------------------------------------------------------- the data --
 * The card is fed by the store now. These guard the specific inventions that
 * were there before, by name, because each was a plausible looking line of
 * code rather than an obvious mistake.
 */
const page = await read("app", "[locale]", "dashboard", "page.tsx");

check("the card reads the feed rather than assembling one",
  /recent:\s*recentEvents/.test(page) && /recentEvents\s*\n?\s*\.filter/.test(page),
  "from useStore");

check("no event is conjured from the first matching flat",
  !/occupied\.find\(\(a\) => a\.rentStatus === "paid"\)/.test(page),
  'the old "any paid flat is a payment" line');
check("no lease event is conjured from the last flat in the list",
  !/occupied\[occupied\.length - 1\]/.test(page),
  'the old "last flat renewed its lease" line');

const dict = await read("lib", "i18n", "dictionaries.ts");
for (const gone of ["hoursAgo", "yesterday", "daysAgo"]) {
  check(`the fixed string ${gone} is gone from the dictionaries`,
    !new RegExp(`^\\s*${gone}:`, "m").test(dict),
    "a time that never changes is not a time");
}

// A lease row is a lease starting. Nothing in the schema records a renewal, so
// the old label described something that had not happened.
check("a new lease is not described as a renewal",
  !/activityLease: "(Bail renouvel|Lease renew)/.test(dict),
  (dict.match(/activityLease: "[^"]*"/) ?? [])[0] ?? "missing");

check("an empty feed says so instead of showing blank cards",
  /recentActivityEmpty/.test(page) &&
    (dict.match(/^\s*recentActivityEmpty:/gm) ?? []).length === 2,
  "in both languages");

/* The adapter has to read the columns that record when, not the columns that
 * record what period something was for. paid_on is the month the money was
 * meant for; created_at is when it was recorded.
 */
const adapter = await read("lib", "supabase", "adapters.ts");
check("payments are dated by when they were recorded",
  /from\("payments"\)[\s\S]{0,240}created_at/.test(adapter),
  "not by the period they settle");
check("tickets are dated by when they were resolved",
  /kind: "ticket"[\s\S]{0,300}resolved_at/.test(adapter),
  "an open ticket has not happened yet");
check("the feed is sorted newest first",
  /Date\.parse\(b\.at\) - Date\.parse\(a\.at\)/.test(adapter),
  "so the order is the order things happened");
check("the feed is scoped to the agency being looked at",
  (adapter.match(/from\("payments"\)[\s\S]{0,320}eq\("agency_id", agencyId\)/) ?? []).length === 1,
  "another agency's events must not appear");

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
