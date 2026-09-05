/**
 * Makes somebody a platform admin.
 *
 *   npm run admin:grant -- amina@chartahome.com
 *
 * Runs with the service role, because the table has no policies on purpose:
 * this is the one thing about the platform that no signed in user, however
 * senior in their agency, can grant themselves.
 */
import { readFileSync } from "node:fs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("usage: npm run admin:grant -- <email>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// The auth admin API pages; the account we want is almost always on the first.
let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const r = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, { headers });
  const body = await r.json();
  const users = body.users ?? [];
  user = users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
  if (users.length < 200) break;
}
if (!user) {
  console.error(`  no account with the address ${email}. They need to sign up first.`);
  process.exit(1);
}

const r = await fetch(`${url}/rest/v1/platform_admins`, {
  method: "POST",
  headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify({ user_id: user.id }),
});
if (!r.ok) {
  console.error(`  insert failed: ${r.status} ${await r.text()}`);
  process.exit(1);
}
console.log(`  ${email} now sits at the platform desk. /admin is theirs.`);
