/**
 * Phone normalisation, checked against the database's own constraint.
 *
 * The regression this exists for: the lease form suggests "+224 620 00 00 00"
 * in its placeholder, and typing exactly that failed the insert on
 * residents_phone_e164_check. Anything a person can reasonably type has to
 * come out as something the column will accept.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isE164, toE164 } from "../lib/phone.ts";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The shapes a person actually types, and what each must become. */
const cases = [
  ["+224 620 14 22 31", "+224620142231", "the format the interface displays"],
  ["+224 620 00 00 00", "+224620000000", "the format the placeholder suggests"],
  ["+224620142231", "+224620142231", "already E.164"],
  ["224 620 14 22 31", "+224620142231", "country code without the plus"],
  ["00224620142231", "+224620142231", "dialled with the 00 prefix"],
  ["620 14 22 31", "+224620142231", "a bare local number"],
  ["620-14-22-31", "+224620142231", "dashes as grouping"],
  ["(620) 14 22 31", "+224620142231", "parentheses round the area code"],
  ["0620142231", "+224620142231", "a national trunk zero, which E.164 drops"],
  ["+33 6 12 34 56 78", "+33612345678", "a French number keeps its own code"],
];

for (const [input, expected, why] of cases) {
  const actual = toE164(input);
  check(`"${input}" becomes ${expected}`, actual === expected, actual === expected ? why : `got ${actual || "empty"}`);
}

/* Nothing that reaches the column may fail its check. */
const allAccepted = cases.every(([input]) => isE164(toE164(input)));
check("every accepted shape satisfies the column's constraint", allAccepted);

/* Blank stays blank: a resident without a number is allowed. */
check("an empty number stays empty rather than being invented", toE164("") === "" && toE164("   ") === "");

/* Nonsense is refused rather than stored as something that will fail later. */
for (const junk of ["abc", "+", "12", "+0224620142231"]) {
  const out = toE164(junk);
  check(`"${junk}" is refused`, out === "" || isE164(out), out === "" ? "empty" : `got ${out}`);
}

/* The guard here and the constraint in Postgres must be the same expression. */
const migration = await readFile(
  path.join(process.cwd(), "supabase", "migrations", "20260808120100_portfolio.sql"),
  "utf8"
);
const inMigration = migration.includes("'^\\+[1-9][0-9]{6,14}$'");
const source = await readFile(path.join(process.cwd(), "lib", "phone.ts"), "utf8");
const inCode = source.includes("/^\\+[1-9][0-9]{6,14}$/");
check("isE164 matches the constraint the column carries", inMigration && inCode);

/* Every write path that touches a phone column has to go through it. */
const actions = await readFile(path.join(process.cwd(), "lib", "supabase", "actions.ts"), "utf8");
const rawWrites = [...actions.matchAll(/(phone_e164|resident_phone):\s*([^,\n]+)/g)]
  .map((m) => m[2].trim())
  .filter((expr) => !expr.includes("toE164") && expr !== "null");
check(
  "no phone reaches the database unnormalised",
  rawWrites.length === 0,
  rawWrites.length ? rawWrites.join(" | ") : "every write goes through toE164"
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
