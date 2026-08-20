/**
 * Where links in outgoing email point.
 *
 * The regression this exists for: an invitation arrived with a link to
 * http://localhost:3000, which is the recipient's own machine, so the account
 * existed and could not be reached. Three call sites each wrote their own
 * `?? "http://localhost:3000"`, so one unset variable in production was enough.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isSiteUrlReachable, siteUrl } from "../lib/site-url.ts";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const KEYS = ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

/** Runs fn with exactly the given variables set, and nothing else. */
function withEnv(env, fn) {
  for (const key of KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  return fn();
}

/* ------------------------------------------------------------ precedence */

check(
  "a configured custom domain wins",
  withEnv(
    {
      NEXT_PUBLIC_SITE_URL: "https://chartahome.com",
      VERCEL_PROJECT_PRODUCTION_URL: "charta.vercel.app",
      VERCEL_URL: "charta-abc123.vercel.app",
    },
    siteUrl
  ) === "https://chartahome.com",
  "the domain a tenant should see"
);

check(
  "the stable production hostname comes next",
  withEnv(
    { VERCEL_PROJECT_PRODUCTION_URL: "charta.vercel.app", VERCEL_URL: "charta-abc123.vercel.app" },
    siteUrl
  ) === "https://charta.vercel.app",
  "not the preview, which changes every push"
);

check(
  "the deployment hostname is the last resort",
  withEnv({ VERCEL_URL: "charta-abc123.vercel.app" }, siteUrl) ===
    "https://charta-abc123.vercel.app"
);

check(
  "localhost only when nothing else is known",
  withEnv({}, siteUrl) === "http://localhost:3000",
  "development"
);

/* ---------------------------------------------------------- normalising */

const shapes = [
  ["chartahome.com", "https://chartahome.com", "Vercel gives a bare hostname"],
  ["https://chartahome.com/", "https://chartahome.com", "a trailing slash is dropped"],
  ["https://chartahome.com///", "https://chartahome.com", "several are dropped"],
  ["http://chartahome.com", "http://chartahome.com", "an explicit scheme is kept"],
  ["  chartahome.com  ", "https://chartahome.com", "surrounding space is ignored"],
];
for (const [input, expected, why] of shapes) {
  const actual = withEnv({ NEXT_PUBLIC_SITE_URL: input }, siteUrl);
  check(`"${input.trim()}" becomes ${expected}`, actual === expected, actual === expected ? why : `got ${actual}`);
}

check(
  "an empty variable is treated as unset rather than as an origin",
  withEnv({ NEXT_PUBLIC_SITE_URL: "   ", VERCEL_URL: "charta.vercel.app" }, siteUrl) ===
    "https://charta.vercel.app"
);

/* ------------------------------------------------------- no double slash */

const joined = withEnv({ NEXT_PUBLIC_SITE_URL: "https://chartahome.com/" }, () => `${siteUrl()}/fr/reset-password`);
check("a link joins without a doubled slash", joined === "https://chartahome.com/fr/reset-password", joined);

/* ------------------------------------------------------------ the guard */

check("localhost is reported as unreachable", withEnv({}, isSiteUrlReachable) === false);
check(
  "a real domain is reported as reachable",
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://chartahome.com" }, isSiteUrlReachable) === true
);

/* ------------------------------- nothing builds its own localhost anymore */

for (const key of KEYS) {
  if (saved[key] === undefined) delete process.env[key];
  else process.env[key] = saved[key];
}

const roots = ["lib", "app", "components"];
const offenders = [];
for (const root of roots) {
  const stack = [path.join(process.cwd(), root)];
  while (stack.length) {
    const dir = stack.pop();
    const { readdir } = await import("node:fs/promises");
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        if (full.endsWith(path.join("lib", "site-url.ts"))) continue;
        const text = await readFile(full, "utf8");
        if (text.includes("localhost:3000")) offenders.push(path.relative(process.cwd(), full));
      }
    }
  }
}
check(
  "only site-url.ts knows about localhost",
  offenders.length === 0,
  offenders.length ? offenders.join(", ") : "every outward link goes through siteUrl()"
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
