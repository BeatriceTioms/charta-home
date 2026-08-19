/**
 * The reminder message is the only thing a tenant ever sees from Charta Home,
 * so the substitution that produces it is worth proving directly.
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// renderMessage is a pure function. Mirrored here rather than imported,
// because lib/whatsapp.ts is TypeScript and this runs on bare node; the
// assertion below keeps the two from drifting apart.
const renderMessage = (template, values) =>
  template.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? values[key] : whole));

const source = readFileSync("lib/whatsapp.ts", "utf8");
check(
  "the mirrored implementation still matches lib/whatsapp.ts",
  source.includes("key in values ? values[key] : whole")
);

const values = {
  tenant: "Mariam Diallo",
  amount: "1 200 000 GNF",
  period: "01/09/2026",
  days: "3",
  agency: "Horizon Realty",
  apartment: "Apt 1A",
};

const filled = renderMessage(
  "Bonjour {tenant}, votre loyer de {amount} pour {apartment} est attendu dans {days} jours, le {period}. {agency}",
  values
);
check("every placeholder is substituted", !filled.includes("{"), filled.slice(0, 60) + "...");
check("the tenant's name lands", filled.includes("Mariam Diallo"));
check("the amount lands", filled.includes("1 200 000 GNF"));

// A typo must be visible, not silently blanked into a hole in the sentence.
const typo = renderMessage("Bonjour {tenat}, votre loyer.", values);
check("an unknown placeholder is left visible", typo.includes("{tenat}"), typo);

// The defaults shipped in the migration must reference only known keys.
const migration = readFileSync("supabase/migrations/20260808120900_reminder_messages.sql", "utf8");
const used = [...migration.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const unknown = [...new Set(used)].filter((k) => !(k in values));
check("shipped defaults use only known placeholders", unknown.length === 0, unknown.join(", ") || "all known");

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
