/**
 * Makes somebody a platform admin.
 *
 *   npm run admin:grant -- desk@chartahome.com
 *
 * Staff are not agencies, so they never go through signup. If no account
 * exists for the address, one is created with no password and Supabase
 * sends the person an invitation; they choose their own password from it.
 * Nothing here ever sees or sets a password.
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
const site = env.NEXT_PUBLIC_SITE_URL || "https://chartahome.com";
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// The desk has to exist before anybody can sit at it.
const probe = await fetch(`${url}/rest/v1/platform_admins?select=user_id&limit=1`, { headers });
if (!probe.ok) {
  console.error("  the platform_admins table is not on this project yet. Paste supabase/bundle.sql into the SQL editor first.");
  process.exit(1);
}

// The auth admin API pages; the account we want is almost always on the first.
let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const r = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, { headers });
  const body = await r.json();
  const users = body.users ?? [];
  user = users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
  if (users.length < 200) break;
}

let invited = false;
if (!user) {
  // Creates the account and mails an invitation in one call. The link lands
  // on the site's reset page, where the person sets their own password.
  const r = await fetch(`${url}/auth/v1/invite`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, data: { platform_admin: true }, redirect_to: `${site}/fr/reset-password` }),
  });
  const body = await r.json();
  if (!r.ok) {
    console.error(`  could not invite ${email}: ${r.status} ${body.msg ?? body.message ?? JSON.stringify(body)}`);
    process.exit(1);
  }
  user = body;
  invited = true;
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
if (invited) {
  console.log(`  An invitation has been emailed to ${email}. They choose their password from it, then sign in.`);
}
