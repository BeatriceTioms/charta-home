import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const env = Object.fromEntries(readFileSync(".env","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.trim().startsWith("#"))
  .map(l=>[l.slice(0,l.indexOf("=")).trim(), l.slice(l.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")]));
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const email = `zz-diagnostic-${randomBytes(4).toString("hex")}@charta-test.invalid`;
const password = randomBytes(18).toString("base64url");

const made = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST", headers: h,
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { diagnostic: true } }),
});
const user = await made.json();
if (!made.ok) { console.error("create failed", user); process.exit(1); }

// Sign in as the test account and give it an agency, exactly as signup does.
const si = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const session = await si.json();
if (!si.ok) { console.error("signin failed", session); process.exit(1); }

const rpc = await fetch(`${url}/rest/v1/rpc/create_agency_for_current_user`, {
  method: "POST",
  headers: { apikey: anon, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ agency_name: "ZZ Diagnostic", agency_country: "Guinea", agency_city: "Conakry",
                         agency_currency: "GNF", agency_locale: "fr", owner_name: "ZZ Diagnostic", plan_code: "starter" }),
});
const agencyId = await rpc.json();
console.log("agency:", rpc.ok ? agencyId : JSON.stringify(agencyId));

writeFileSync("/tmp/diag.json", JSON.stringify({ email, password, userId: user.id, agencyId, access_token: session.access_token, refresh_token: session.refresh_token }));
console.log("test account ready:", email);
