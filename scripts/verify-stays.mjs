/**
 * Charta Home · letting by the night
 *
 * The database holds the rules that matter and verify-rls proves them. What
 * this checks is the half that only shows on screen: that a stay is kept out
 * of the rent machinery, that nothing invents a price the agency did not set,
 * and that money a guest has not paid yet is not counted as income.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const read = (...p) => readFile(path.join(process.cwd(), ...p), "utf8");

const migration = await read("supabase", "migrations", "20260808122900_short_stays.sql");
const panel = await read("components", "dashboard", "StaysPanel.tsx");
const card = await read("components", "dashboard", "StayRatesCard.tsx");
const rent = await read("app", "[locale]", "dashboard", "rent", "page.tsx");
const dict = await read("lib", "i18n", "dictionaries.ts");
const actions = await read("lib", "supabase", "actions.ts");

/* ------------------------------------------- a stay is not a tenancy --- */
check("a stay is its own table, not a lease with a short cycle",
  /create table if not exists stays/.test(migration) && !/insert into public\.leases/.test(migration),
  "no rent charges, no arrears, no reminder cadence for a guest");
check("and raises no rent charge",
  !/ensure_rent_charge/.test(migration), "three nights is not a period");
check("the lease columns of the unit view keep their meaning",
  /\(l\.id is not null\) as is_occupied/.test(migration),
  "a guest arriving must not move the vacancy figure for long lets");

/* ------------------------------------------------ one guest at a time --- */
const create = migration.slice(migration.indexOf("function public.create_stay"), migration.indexOf("grant execute on function public.create_stay"));
check("the clash check and the insert are under one lock",
  create.indexOf("pg_advisory_xact_lock") < create.indexOf("daterange") &&
    create.indexOf("daterange") < create.indexOf("insert into public.stays"),
  "two bookings in the same second cannot both land");
check("the dates are half open, so check out day is free",
  /daterange\(s\.check_in, s\.check_out, '\[\)'\)/.test(create),
  "a guest leaving on the 5th frees the night of the 5th");
check("a cancelled stay holds no dates",
  /s\.status <> 'cancelled'/.test(create));

/* ---------------------------------------------- the agency's own prices --- */
check("the price is given, never interpolated between packages",
  /amount_in bigint/.test(create),
  "a price the agency did not set is one it cannot stand behind");
check("the rate editor sends the whole list, so a removed row is removed",
  /setStayRates/.test(card) && /rates: \{ minNights: number; maxNights: number \| null; pricePerNight: number \}\[\]/.test(actions));
check("two packages for the same number of nights are refused before the database has to",
  /stay-duplicate-nights/.test(actions) && /duplicateNights/.test(card));
check("offering no package at all stops the unit being offered by the night",
  /short_stay: clean\.length > 0/.test(actions));

/* ------------------------------------------------------------- money --- */
check("income counts what a guest paid, never what was agreed",
  /sum\(s\.paid\)/.test(migration) && !/sum\(s\.amount\)/.test(migration),
  "a booking taken for March is not March's income in advance");
check("and dates it by when it arrived",
  /s\.paid > 0 and s\.paid_on >= date_trunc\('year', current_date\)/.test(migration));
check("what a guest paid reaches the unit and the building alike",
  /stay_year/.test(migration) && /join apartments ap3 on ap3\.id = s\.apartment_id/.test(migration));
check("the panel shows what is still owed rather than only the total",
  /const owed = x\.amount - x\.paid/.test(panel));

/* ------------------------------------------------------------ on screen --- */
check("stays are a tab on rent collection, beside the leases",
  /StaysPanel/.test(rent) && /key: "stays"/.test(rent));
check("its count is bookings that have not finished",
  /x\.checkOut > todayIso/.test(rent), "a year of past guests is not a to do list");
check("only a unit offered by the night can be booked",
  /building\.apartments\.filter\(\(a\) => a\.shortStay\.enabled\)/.test(panel));
const keys = [...panel.matchAll(/\bs\.(\w+)/g), ...card.matchAll(/\bs\.(\w+)/g)].map((m) => m[1]);
const missing = [...new Set(keys)].filter(
  (k) => (dict.match(new RegExp(`^\\s*${k}:`, "gm")) ?? []).length < 2
);
check("every label the stays screens show exists in both languages",
  missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `${new Set(keys).size} keys`);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
