/**
 * Phase 0 gate: is the live Supabase project reachable, migrated and seeded?
 *
 * Reads .env directly so it can run outside Next. Prints counts only, never
 * credentials.
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const raw of (await readFile(".env", "utf8")).split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const [k, ...rest] = line.split("=");
  env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env");
  process.exit(1);
}
console.log(`  project: ${new URL(url).host}`);

const db = createClient(url, key, { auth: { persistSession: false } });

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const count = async (table) => {
  const { count: n, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return n ?? 0;
};

try {
  check("agencies seeded", (await count("agencies")) === 1);
  check("buildings seeded", (await count("buildings")) === 3, `${await count("buildings")} rows`);
  check("apartments seeded", (await count("apartments")) === 12, `${await count("apartments")} rows`);
  check("leases seeded", (await count("leases")) === 10, `${await count("leases")} rows`);
  check("technicians seeded", (await count("technicians")) === 4);
  check("tickets seeded", (await count("tickets")) === 4);

  const { data: perf, error: perfError } = await db.from("v_building_performance").select("*");
  if (perfError) throw new Error(`v_building_performance: ${perfError.message}`);
  check("performance view answers", (perf ?? []).length === 3, `${(perf ?? []).length} buildings`);
  for (const b of perf ?? []) {
    console.log(
      `        ${b.name}: ${b.occupied_count}/${b.apartment_count} occupied, income ${b.income_ytd}`
    );
  }

  const { data: states, error: stateError } = await db.from("v_apartment_state").select("rent_state");
  if (stateError) throw new Error(`v_apartment_state: ${stateError.message}`);
  const tally = {};
  for (const s of states ?? []) tally[s.rent_state ?? "vacant"] = (tally[s.rent_state ?? "vacant"] ?? 0) + 1;
  check("rent states derive", (states ?? []).length === 12, JSON.stringify(tally));
} catch (err) {
  check("reachable", false, err.message);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
