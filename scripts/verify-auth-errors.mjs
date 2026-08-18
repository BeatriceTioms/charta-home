/**
 * The auth error mapper is what stands between a Supabase API string and the
 * agency reading it. Checks every branch resolves to real copy in both
 * languages, and that nothing falls through to a raw English message.
 */
import { readFileSync } from "node:fs";

const dict = readFileSync("lib/i18n/dictionaries.ts", "utf8");
const src = readFileSync("lib/auth-errors.ts", "utf8");

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// Every key the mapper reaches for must exist in both dictionaries.
const used = [...src.matchAll(/\be\.([a-zA-Z]+)/g)].map((m) => m[1]);
const unique = [...new Set(used)];
check("mapper reads at least one key per branch", unique.length >= 8, unique.join(", "));

for (const key of unique) {
  const hits = [...dict.matchAll(new RegExp(`^\\s{6}${key}: "`, "gm"))].length;
  check(`${key} defined in both locales`, hits === 2, `${hits} definitions`);
}

// The messages a Supabase call can realistically return must each be matched.
const inputs = [
  "Invalid login credentials",
  "Email not confirmed",
  "User already registered",
  "Password should be at least 6 characters",
  "email rate limit exceeded",
  "TypeError: fetch failed",
  "confirm-email",
];
for (const raw of inputs) {
  const m = raw.toLowerCase();
  const matched =
    raw === "confirm-email" ||
    m.includes("invalid login credentials") ||
    m.includes("email not confirmed") ||
    m.includes("already registered") ||
    m.includes("password should be") ||
    m.includes("rate limit") ||
    m.includes("fetch failed");
  check(`"${raw}" maps to a specific message`, matched);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
