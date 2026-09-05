/**
 * Charta Home · the pricing model
 *
 * The model lives twice: once in lib/pricing.ts, which the marketing page
 * reads before anyone signs in, and once in the migration that seeds
 * plan_prices, which the database enforces and invoices from. Two copies of
 * a price list drift, and a drift here is an agency invoiced a number the
 * website never showed. So the first thing this does is hold them together.
 *
 * Two decisions were taken reading the sheet, and are pinned here so they
 * cannot be lost:
 *   - the second tier's band overlapped the third (31 to 100 and 51 to 100),
 *     so it is 31 to 50, the only reading that leaves one tier per count;
 *   - Cameroon Pro was 500 000, which is the Guinea figure and ten times the
 *     tier above it, so it is 50 000, in step with 30 000 and 55 000.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ANNUAL_MONTHS,
  PLAN_BANDS,
  PLAN_CODES,
  PLAN_PRICES,
  PRICING_COUNTRIES,
  currencyFor,
  planForApartments,
  priceFor,
} from "../lib/pricing.ts";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const read = (...p) => readFile(path.join(process.cwd(), ...p), "utf8");

/* ---------------------------------------------- the two copies agree --- */
const migration = await read("supabase", "migrations", "20260808122100_pricing_plans.sql");

const seededBands = Object.fromEntries(
  [...migration.matchAll(/\('(\w+)',\s*(\d+),\s*(\d+),\s*(\d+|null)\)/g)]
    .map((m) => [m[1], { rank: Number(m[2]), min: Number(m[3]), max: m[4] === "null" ? null : Number(m[4]) }])
);
check("the migration seeds the same five tiers",
  Object.keys(seededBands).sort().join() === [...PLAN_CODES].sort().join(),
  Object.keys(seededBands).join(", "));
check("in the same order",
  PLAN_CODES.every((code, i) => seededBands[code]?.rank === i + 1));
check("with the same bands",
  PLAN_CODES.every((code) =>
    seededBands[code]?.min === PLAN_BANDS[code].min && seededBands[code]?.max === PLAN_BANDS[code].max),
  PLAN_CODES.map((c) => `${c} ${PLAN_BANDS[c].min}..${PLAN_BANDS[c].max ?? "∞"}`).join(" "));

const seededPrices = [...migration.matchAll(/\('(\w+)',\s*'(\w+)',\s*'([A-Z]{3})',\s*(\d+|null),\s*(\d+|null)\)/g)]
  .map((m) => ({ plan: m[1], country: m[2], currency: m[3],
    monthly: m[4] === "null" ? null : Number(m[4]), annual: m[5] === "null" ? null : Number(m[5]) }));
check("ten price rows are seeded", seededPrices.length === 10, `${seededPrices.length}`);

let mismatch = [];
for (const country of PRICING_COUNTRIES) {
  for (const code of PLAN_CODES) {
    const row = seededPrices.find((r) => r.plan === code && r.country === country);
    const ts = PLAN_PRICES[country].monthly[code];
    if (!row || row.monthly !== ts || row.currency !== PLAN_PRICES[country].currency) {
      mismatch.push(`${country}/${code}: sql=${row?.monthly ?? "missing"} ts=${ts}`);
    }
  }
}
check("every monthly price matches between the catalogue and the migration",
  mismatch.length === 0, mismatch.join("; ") || "10/10");
check("every yearly price in the migration is ten months",
  seededPrices.filter((r) => r.monthly !== null).every((r) => r.annual === r.monthly * ANNUAL_MONTHS),
  `ANNUAL_MONTHS = ${ANNUAL_MONTHS}`);
check("Enterprise is null in both copies",
  seededPrices.filter((r) => r.plan === "enterprise").every((r) => r.monthly === null && r.annual === null) &&
    PRICING_COUNTRIES.every((c) => PLAN_PRICES[c].monthly.enterprise === null));

/* --------------------------------------------------- the model itself --- */
check("the bands are contiguous from one",
  PLAN_CODES.every((code, i) =>
    i === 0 ? PLAN_BANDS[code].min === 1 : PLAN_BANDS[code].min === PLAN_BANDS[PLAN_CODES[i - 1]].max + 1));
check("the sheet's numbers, as read",
  PLAN_PRICES.Guinea.monthly.starter === 175000 && PLAN_PRICES.Guinea.monthly.business === 850000 &&
    PLAN_PRICES.Cameroon.monthly.starter === 12000 && PLAN_PRICES.Cameroon.monthly.business === 55000);
check("the two readings of the sheet are the ones intended",
  PLAN_BANDS.growth.max === 50 && PLAN_PRICES.Cameroon.monthly.pro === 50000,
  "growth stops at 50; Cameroon Pro is 50 000, not 500 000");
check("a yearly price is monthly times ten",
  priceFor("Guinea", "pro", "annual")?.amount === 5000000 && priceFor("Cameroon", "starter", "annual")?.amount === 120000);
check("a country without a list gets no price rather than another country's",
  priceFor("Mali", "starter", "monthly") === null);
check("the smallest tier that holds a count",
  planForApartments(1) === "starter" && planForApartments(30) === "starter" && planForApartments(31) === "growth" &&
    planForApartments(100) === "pro" && planForApartments(101) === "business" && planForApartments(251) === "enterprise");
check("Cameroon bills in XAF, Guinea in GNF, elsewhere in dollars",
  currencyFor("Cameroon") === "XAF" && currencyFor("Guinea") === "GNF" && currencyFor("France") === "USD",
  "signup used to give Cameroon dollars");

/* -------------------------------------------------------- the surfaces --- */
const dict = await read("lib", "i18n", "dictionaries.ts");
const plansBlocks = [...dict.matchAll(/\n  plans: \{[\s\S]*?\n  \},\n/g)].map((m) => m[0]);
check("both languages carry a plans block", plansBlocks.length === 2, `${plansBlocks.length}`);
check("no price in dollars anywhere in the plans copy",
  plansBlocks.every((b) => !/\$|USD|dollar/i.test(b)),
  "prices are francs");
const tierKeys = plansBlocks.map((b) => [...b.matchAll(/^\s{6}(\w+): \{ name:/gm)].map((m) => m[1]).join());
check("the five tiers are named in both languages",
  tierKeys[0] === tierKeys[1] && tierKeys[0] === PLAN_CODES.join(), tierKeys[0]);
check("nothing says the trial has 21 days left",
  !/21 jours|21 days/.test(dict),
  "the sidebar used to say it for every agency on every day");

const layout = await read("app", "[locale]", "layout.tsx");
check("the structured data no longer advertises dollars",
  !/priceCurrency: "USD"/.test(layout) && /priceFor\(/.test(layout));

const signup = await read("app", "[locale]", "signup", "page.tsx");
const auth = await read("lib", "supabase", "auth-actions.ts");
check("the pricing page's choice reaches signup",
  /name="plan"/.test(signup) && /plan_code: plan/.test(auth));
check("signup bills in the country's currency",
  /agency_currency: currencyFor\(country\)/.test(auth));

const settings = await read("components", "dashboard", "SettingsForm.tsx");
check("settings sends the request through the server action",
  /sb\.requestPlan\(/.test(settings) && !/notify\(s\.changePlan\)/.test(settings),
  "it used to toast the button's own label");

check("the migration closes the owner's write to their subscription",
  /drop policy if exists subscriptions_update/.test(migration));
check("the migration enforces the ceiling on insert",
  /create trigger apartments_plan_limit before insert on apartments/.test(migration));

const env = await read(".env.example");
check("the sales inbox is documented", /SALES_EMAIL=/.test(env) && /MOBILE_MONEY_ORANGE=/.test(env));

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
