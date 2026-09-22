/**
 * Charta Home · the pricing model
 *
 * The model lives twice: once in lib/pricing.ts, which the marketing page
 * reads before anyone signs in, and once in the migration that seeds
 * plan_prices, which the database enforces and invoices from. Two copies of
 * a price list drift, and a drift here is an agency invoiced a number the
 * website never showed. So the first thing this does is hold them together.
 *
 * The sheet has three tiers. An earlier reading had five, two of them
 * invented to resolve what looked like overlaps; the second migration takes
 * them back out, so the catalogue is the seed of the first migration with the
 * second applied, and that is what is compared here.
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
  tierName,
} from "../lib/pricing.ts";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const read = (...p) => readFile(path.join(process.cwd(), ...p), "utf8");

/* ---------------------------------------------- the two copies agree --- */
const migration = await read("supabase", "migrations", "20260808122100_pricing_plans.sql");
const reduction = await read("supabase", "migrations", "20260808122600_three_tiers.sql");

const seededBands = Object.fromEntries(
  [...migration.matchAll(/\('(\w+)',\s*(\d+),\s*(\d+),\s*(\d+|null)\)/g)]
    .map((m) => [m[1], { rank: Number(m[2]), min: Number(m[3]), max: m[4] === "null" ? null : Number(m[4]) }])
);
// The second migration deletes tiers and reshapes the ones that stay.
for (const gone of [...reduction.matchAll(/delete from plans\s+where code in \(([^)]*)\)/g)].flatMap((m) => m[1].match(/'(\w+)'/g).map((x) => x.replace(/'/g, "")))) {
  delete seededBands[gone];
}
for (const m of reduction.matchAll(/update plans set rank = (\d+), min_apartments = (\d+),\s*max_apartments = (\d+) where code = '(\w+)'/g)) {
  seededBands[m[4]] = { rank: Number(m[1]), min: Number(m[2]), max: Number(m[3]) };
}
check("the migrations leave the same three tiers",
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
const deletedPlans = new Set([...reduction.matchAll(/delete from plan_prices where plan in \(([^)]*)\)/g)].flatMap((m) => m[1].match(/'(\w+)'/g).map((x) => x.replace(/'/g, ""))));
const livePrices = seededPrices.filter((r) => !deletedPlans.has(r.plan));
check("six price rows survive the reduction", livePrices.length === 6, `${livePrices.length}`);

let mismatch = [];
for (const country of PRICING_COUNTRIES) {
  for (const code of PLAN_CODES) {
    const row = livePrices.find((r) => r.plan === code && r.country === country);
    const ts = PLAN_PRICES[country].monthly[code];
    if (!row || row.monthly !== ts || row.currency !== PLAN_PRICES[country].currency) {
      mismatch.push(`${country}/${code}: sql=${row?.monthly ?? "missing"} ts=${ts}`);
    }
  }
}
check("every monthly price matches between the catalogue and the migration",
  mismatch.length === 0, mismatch.join("; ") || "10/10");
check("every yearly price in the migration is ten months",
  livePrices.every((r) => r.annual === r.monthly * ANNUAL_MONTHS),
  `ANNUAL_MONTHS = ${ANNUAL_MONTHS}`);
check("every listed tier has a number; nothing is on quote in a listed country",
  livePrices.every((r) => r.monthly !== null));

/* --------------------------------------------------- the model itself --- */
check("the bands are contiguous from one",
  PLAN_CODES.every((code, i) =>
    i === 0 ? PLAN_BANDS[code].min === 1 : PLAN_BANDS[code].min === PLAN_BANDS[PLAN_CODES[i - 1]].max + 1));
check("the sheet's numbers, as written",
  PLAN_PRICES.Guinea.monthly.starter === 175000 && PLAN_PRICES.Guinea.monthly.growth === 450000 && PLAN_PRICES.Guinea.monthly.business === 850000 &&
    PLAN_PRICES.Cameroon.monthly.starter === 12000 && PLAN_PRICES.Cameroon.monthly.growth === 30000 && PLAN_PRICES.Cameroon.monthly.business === 55000);
check("the sheet's bands, as written",
  PLAN_BANDS.starter.max === 30 && PLAN_BANDS.growth.min === 31 && PLAN_BANDS.growth.max === 100 && PLAN_BANDS.business.min === 101 && PLAN_BANDS.business.max === 250,
  "1 to 30, 31 to 100, 101 to 250");
check("the middle tier is Professional in Guinea and Growth in Cameroon",
  tierName("growth", "Guinea", "Growth") === "Professional" && tierName("growth", "Cameroon", "Growth") === "Growth" && tierName("starter", "Guinea", "Starter") === "Starter",
  "one code, two names, as on the sheet");
check("a yearly price is monthly times ten",
  priceFor("Guinea", "growth", "annual")?.amount === 4500000 && priceFor("Cameroon", "starter", "annual")?.amount === 120000);
check("a country without a list gets no price rather than another country's",
  priceFor("Mali", "starter", "monthly") === null);
check("the smallest tier that holds a count",
  planForApartments(1) === "starter" && planForApartments(30) === "starter" && planForApartments(31) === "growth" &&
    planForApartments(100) === "growth" && planForApartments(101) === "business" && planForApartments(250) === "business" && planForApartments(251) === "business");
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
check("the three tiers are named in both languages",
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
const actions = await read("lib", "supabase", "actions.ts");
const adminActions = await read("lib", "supabase", "admin-actions.ts");
check("a plan request is emailed to everyone at the desk as well as the sales inbox",
  /platformAdminEmails\(\)/.test(actions) && /new Set\(\[sales, \.\.\./.test(actions) && /for \(const to of recipients\)/.test(actions),
  "each address once, however many ways it is listed");
check("the desk's addresses are read with the service role, not as the requesting owner",
  /export async function platformAdminEmails/.test(adminActions) && /createAdminClient\(\)/.test(adminActions.slice(adminActions.indexOf("platformAdminEmails"))),
  "platform_admins has no policies and auth.users is not readable by an owner");
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
