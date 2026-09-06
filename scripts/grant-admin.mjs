/**
 * Makes somebody a platform admin.
 *
 *   npm run admin:grant -- desk@chartahome.com
 *
 * Staff are not agencies, so they never go through signup. If no account
 * exists for the address, one is created with no password. Either way a
 * link to set a password is issued and sent through Resend, the same way
 * team invitations go, because Supabase's own mailer is rate limited to a
 * few messages an hour, sends from a shared address that Gmail files as
 * spam, and its links die after a day. Without a Resend key the link is
 * printed for the person running this to pass on themselves.
 *
 * Nothing here ever sees or sets a password. Running it again for the same
 * address just issues a fresh link.
 *
 * Runs with the service role, because the table has no policies on purpose:
 * this is the one thing about the platform that no signed in user, however
 * senior in their agency, can grant themselves.
 */
import { readFileSync } from "node:fs";
import { isEmailConfigured, passwordResetEmail, sendEmail } from "../lib/email.ts";

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
for (const [k, v] of Object.entries(env)) process.env[k] ??= v;

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env");
  process.exit(1);
}
const site = (env.NEXT_PUBLIC_SITE_URL || "https://chartahome.com").replace(/\/$/, "");
const locale = process.argv.includes("--en") ? "en" : "fr";
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

if (!user) {
  // Created directly and marked confirmed, so no mail goes out from here and
  // the only message the person receives is the one below.
  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { platform_admin: true } }),
  });
  const body = await r.json();
  if (!r.ok) {
    console.error(`  could not create ${email}: ${r.status} ${body.msg ?? body.message ?? JSON.stringify(body)}`);
    process.exit(1);
  }
  user = body;
  console.log(`  created an account for ${email}, with no password yet.`);
}

const grant = await fetch(`${url}/rest/v1/platform_admins`, {
  method: "POST",
  headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify({ user_id: user.id }),
});
if (!grant.ok) {
  console.error(`  insert failed: ${grant.status} ${await grant.text()}`);
  process.exit(1);
}
console.log(`  ${email} now sits at the platform desk. /admin is theirs.`);

// A link to set the password. Recovery rather than invite, because an invite
// link is refused for an account that already exists, and this has to work
// the second time it is run as well as the first.
const link = await fetch(`${url}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers,
  body: JSON.stringify({ type: "recovery", email, redirect_to: `${site}/${locale}/reset-password` }),
});
const linkBody = await link.json();
const actionLink = linkBody.action_link ?? linkBody.properties?.action_link;
if (!link.ok || !actionLink) {
  console.error(`  could not issue a password link: ${link.status} ${linkBody.msg ?? linkBody.message ?? JSON.stringify(linkBody)}`);
  process.exit(1);
}

if (isEmailConfigured()) {
  const message = passwordResetEmail({ resetLink: actionLink, locale });
  const sent = await sendEmail({ to: email, ...message });
  if (!sent.ok) {
    console.error(`  Resend refused the message: ${sent.error}`);
    process.exit(1);
  }
  console.log(`  A password link has been emailed to ${email} from ${process.env.EMAIL_FROM}. It is good for one hour.`);
} else {
  console.log("");
  console.log("  No RESEND_API_KEY in .env, so the link is printed here instead of emailed.");
  console.log("  It signs the person in to set a password, so hand it over directly and do not paste it anywhere public.");
  console.log("  Good for one hour:");
  console.log("");
  console.log(`  ${actionLink}`);
  console.log("");
}
