/** Applies migrations + seed.sql, then checks the seeded data looks right. */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const db = new PGlite({ extensions: { citext, pgcrypto } });
const q = async (sql) => (await db.query(sql)).rows;

await db.exec(`
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth; create schema if not exists storage;
create extension if not exists pgcrypto; create extension if not exists citext;
-- Mirrors Supabase's own auth schema closely enough to catch the differences
-- that matter. The email uniqueness is a PARTIAL index there, not a plain
-- constraint, so "on conflict (email)" fails against a real project. Declaring
-- it the easy way here hid exactly that bug.
create table auth.users (
  instance_id uuid, id uuid primary key default gen_random_uuid(),
  aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb,
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
  select string_to_array(name,'/') $$;
`);

const dir = path.join(process.cwd(), "supabase", "migrations");
for (const f of (await readdir(dir)).filter((x) => x.endsWith(".sql")).sort()) {
  await db.exec(await readFile(path.join(dir, f), "utf8"));
}

const seed = await readFile(path.join(process.cwd(), "supabase", "seed.sql"), "utf8");

try {
  await db.exec(seed);
  console.log("  seed applied");
} catch (err) {
  console.error("  SEED FAILED:", err.message);
  process.exit(1);
}

const rows = async (sql) => (await q(sql))[0];
const agency = await rows(`select id, name, currency from agencies limit 1`);
const counts = await rows(`
  select
    (select count(*) from buildings)::int  as buildings,
    (select count(*) from apartments)::int as apartments,
    (select count(*) from leases)::int     as leases,
    (select count(*) from tickets)::int    as tickets,
    (select count(*) from events)::int     as events,
    (select count(*) from technicians)::int as technicians
`);
const states = await q(`select rent_state, count(*)::int as n from v_apartment_state group by 1 order by 1`);
const perf = await q(`select name, apartment_count, occupied_count, income_ytd, net_yield_pct from v_building_performance order by name`);

console.log(`  agency: ${agency.name} (${agency.currency})`);
console.log(`  counts:`, counts);
console.log(`  rent states:`, states.map((r) => `${r.rent_state}=${r.n}`).join(" "));
for (const p of perf) {
  console.log(`  ${p.name}: ${p.occupied_count}/${p.apartment_count} occupied, income ${p.income_ytd}, yield ${p.net_yield_pct}%`);
}

// The seed is likely to be run more than once against a live project, so it
// must be a no op the second time rather than a second Horizon Realty.
await db.exec(seed);
const [again] = (await db.query(`select count(*)::int as n from agencies`)).rows;
const idempotent = again.n === 1;
console.log(`  re-run: ${again.n} agency row${again.n === 1 ? "" : "s"} after seeding twice`);

const ok =
  idempotent &&
  counts.buildings === 3 &&
  counts.apartments === 12 &&
  counts.leases === 10 &&
  states.some((r) => r.rent_state === "paid") &&
  states.some((r) => r.rent_state === "overdue");

console.log(ok ? "\nseed verification PASSED" : "\nseed verification FAILED");
await db.close();
process.exit(ok ? 0 : 1);
