/**
 * Runs the Supabase migrations against an in-process Postgres (PGlite) to catch
 * SQL errors without needing Docker. Supabase-managed schemas (auth, storage)
 * are stubbed just enough for the DDL to apply.
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATIONS = path.join(process.cwd(), "supabase", "migrations");

const STUBS = `
-- Supabase-managed roles
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- current_setting based stand-in for Supabase's auth.uid()
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/')
$$;
`;

const db = new PGlite({ extensions: { citext, pgcrypto } });
await db.exec(`create extension if not exists pgcrypto; create extension if not exists citext;`);
await db.exec(STUBS);

const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
let applied = 0;

for (const file of files) {
  const sql = await readFile(path.join(MIGRATIONS, file), "utf8");
  try {
    await db.exec(sql);
    console.log(`  ok   ${file}`);
    applied++;
  } catch (err) {
    console.error(`  FAIL ${file}`);
    console.error(`       ${err.message}`);
    process.exit(1);
  }
}

// Inventory what the schema actually produced.
const q = async (sql) => (await db.query(sql)).rows;

const tables = await q(`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE' order by 1
`);
const views = await q(`
  select table_name from information_schema.views
  where table_schema = 'public' order by 1
`);
const policies = await q(`select count(*)::int as n from pg_policies where schemaname in ('public','storage')`);
const rlsOff = await q(`
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  order by 1
`);
const funcs = await q(`
  select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' order by 1
`);

console.log(`\n${applied}/${files.length} migrations applied`);
console.log(`tables   (${tables.length}): ${tables.map((r) => r.table_name).join(", ")}`);
console.log(`views    (${views.length}): ${views.map((r) => r.table_name).join(", ")}`);
console.log(`functions(${funcs.length}): ${funcs.map((r) => r.proname).join(", ")}`);
console.log(`policies : ${policies[0].n}`);
console.log(`RLS disabled on: ${rlsOff.length ? rlsOff.map((r) => r.relname).join(", ") : "none"}`);

await db.close();
