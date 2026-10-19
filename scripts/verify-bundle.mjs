/**
 * Applies supabase/bundle.sql as one statement stream, exactly the way the
 * Supabase SQL editor would, then the seed on top. Proves the paste-in path
 * works for a project where the CLI is not linked.
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const db = new PGlite({ extensions: { citext, pgcrypto } });

await db.exec(`
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create schema if not exists storage;
create extension if not exists pgcrypto;
create extension if not exists citext;
create table auth.users (
  instance_id uuid, id uuid primary key default gen_random_uuid(),
  aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  confirmation_token text, recovery_token text, email_change text,
  email_change_token_new text, email_change_token_current text,
  phone_change text, phone_change_token text, reauthentication_token text,
  is_sso_user boolean not null default false
);
create unique index users_email_partial_key on auth.users (email) where is_sso_user = false;
create table auth.identities (
  provider_id text not null, user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null, provider text not null,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
  id uuid primary key default gen_random_uuid(),
  unique (provider_id, provider)
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table storage.buckets (id text primary key, name text not null, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/') $$;
`);

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const read = (f) => readFile(path.join(process.cwd(), "supabase", f), "utf8");

try {
  await db.exec(await read("bundle.sql"));
  check("bundle.sql applies in one run", true);
} catch (err) {
  check("bundle.sql applies in one run", false, err.message);
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
  process.exit(1);
}

// Pasting the bundle into a project that already has part of it applied is the
// ordinary case once the schema starts growing. Running the whole thing a
// second time is the strongest form of that: if this passes, no partially
// applied project can hit a duplicate object error either.
try {
  await db.exec(await read("bundle.sql"));
  check("bundle.sql applies again on top of itself", true);
} catch (err) {
  check("bundle.sql applies again on top of itself", false, err.message);
}

const q = async (sql) => (await db.query(sql)).rows;

const [tables] = await q(
  `select count(*)::int as n from pg_tables where schemaname = 'public'`
);
// A deliberate canary: this number is expected to change when the schema
// grows, and a mismatch means either a new table or a bundle that truncated.
// 28: plan_limits went; plans, plan_prices, plan_requests, platform_admins
// and plan_codes arrived. 34: the resident app added lease_requests,
// resident_payments and resident_devices.
check("every table is created", tables.n === 34, `${tables.n} tables`);

const [views] = await q(
  `select count(*)::int as n from pg_views where schemaname = 'public'`
);
check("every view is created", views.n === 6, `${views.n} views`);

const [unguarded] = await q(`
  select count(*)::int as n from pg_tables t
  join pg_class c on c.relname = t.tablename
  where t.schemaname = 'public' and not c.relrowsecurity`);
check("row level security on every table", unguarded.n === 0, `${unguarded.n} unguarded`);

try {
  await db.exec(await read("seed.sql"));
  check("seed.sql runs on top of the bundle", true);
} catch (err) {
  check("seed.sql runs on top of the bundle", false, err.message);
}

const [agencies] = await q(`select count(*)::int as n from agencies`);
check("the demo agency lands", agencies.n === 1, `${agencies.n} agencies`);

const [user] = await q(
  `select count(*)::int as n from auth.users where email = 'amina@horizonrealty.gn'`
);
check("the demo user is created", user.n === 1);

const [identity] = await q(`select count(*)::int as n from auth.identities`);
check("the sign in identity is written", identity.n === 1, `${identity.n} identities`);

// The repair file is what an already seeded project runs, so prove it on a row
// broken the way those projects are broken.
await db.exec(`update auth.users set confirmation_token = null, recovery_token = null,
  email_change = null, email_change_token_new = null, email_change_token_current = null,
  phone_change = null, phone_change_token = null, reauthentication_token = null`);
await db.exec(await read("fix-demo-user.sql"));
const [repaired] = await q(`
  select count(*)::int as n from auth.users
  where confirmation_token is null or recovery_token is null
    or email_change is null or email_change_token_new is null
    or email_change_token_current is null or phone_change is null
    or phone_change_token is null or reauthentication_token is null`);
check("fix-demo-user.sql repairs a broken row", repaired.n === 0, `${repaired.n} still null`);

await db.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
