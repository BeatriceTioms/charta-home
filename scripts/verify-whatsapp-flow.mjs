/**
 * How an inbound WhatsApp message is routed.
 *
 * The rules here are the difference between a usable maintenance channel and
 * an unusable one, and none of them are visible from reading a single message.
 * A tenant writes "bonjour", then the problem, then sends a photograph: that is
 * one report, not three. A tenant with two flats has to be asked which, once,
 * and must not have to retype what they already wrote. A number nobody knows
 * gets nothing back, because a reply would tell a stranger whether a number
 * belongs to one of our tenants.
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const db = new PGlite({ extensions: { citext, pgcrypto } });
await db.exec(`
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth; create schema if not exists storage;
create extension if not exists pgcrypto; create extension if not exists citext;
create table auth.users (instance_id uuid, id uuid primary key default gen_random_uuid(), aud text, role text,
  email text, encrypted_password text, email_confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, confirmation_token text, recovery_token text, email_change text,
  email_change_token_new text, email_change_token_current text, phone_change text, phone_change_token text,
  reauthentication_token text, is_sso_user boolean not null default false);
create table auth.identities (provider_id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null, provider text not null, last_sign_in_at timestamptz, created_at timestamptz,
  updated_at timestamptz, id uuid primary key default gen_random_uuid(), unique(provider_id, provider));
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table storage.buckets (id text primary key, name text not null, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name,'/') $$;
`);
await db.exec(await readFile(path.join(process.cwd(), "supabase", "bundle.sql"), "utf8"));

const uid = "11111111-1111-1111-1111-111111111111";
await db.exec(`insert into auth.users (id,email) values ('${uid}','a@t.gn');`);
await db.exec(`set request.jwt.claim.sub = '${uid}';`);
const agency = (await db.query(
  `select create_agency_for_current_user('A','Conakry','GNF') as id`
)).rows[0].id;
await db.exec(`insert into buildings (id,agency_id,name,address,city)
  values ('22222222-2222-2222-2222-222222222222','${agency}','B','A','Conakry')`);
for (const [id, label] of [
  ["33333333-3333-3333-3333-333333333333", "Apt 2A"],
  ["44444444-4444-4444-4444-444444444444", "Apt 5B"],
]) {
  await db.exec(`insert into apartments (id,agency_id,building_id,label,rooms,bathrooms,sqm,base_rent)
    values ('${id}','${agency}','22222222-2222-2222-2222-222222222222','${label}',2,1,60,1000000)`);
}

const phone = "+224620000009";
await db.query(`select create_lease('33333333-3333-3333-3333-333333333333','Sofia','${phone}',1000000,
  'monthly'::lease_cycle, date '2026-01-01', 0, null)`);

const conversation = async () =>
  (await db.query(`select id from wa_conversations where phone_e164='${phone}'`)).rows[0]?.id;
const route = async (body) =>
  (await db.query(`select decision, lease_count, report from wa_route_inbound('${phone}', $1)`, [body]))
    .rows[0];

/* ------------------------------------------- one report, several messages */

check("a first message opens a report", (await route("bonjour")).decision === "open");

const ticket = (await db.query(`insert into tickets (agency_id,building_id,apartment_id,title,reported_via)
  values ('${agency}','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','bonjour','whatsapp')
  returning id`)).rows[0].id;
await db.query(`select wa_set_state('${await conversation()}','idle',null,'${ticket}')`);

check("the next message joins it rather than opening another",
  (await route("le robinet de la salle de bain fuit")).decision === "attach",
  "a greeting and the problem are one report");
check("a photograph joins it too",
  (await route("")).decision === "attach",
  "sent seconds later, plainly the same subject");

const ticketCount = (await db.query(`select count(*)::int n from tickets`)).rows[0].n;
check("three messages made one ticket", ticketCount === 1, `${ticketCount} ticket(s)`);

/* -------------------------------------------------- more than one tenancy */

await db.query(`select create_lease('44444444-4444-4444-4444-444444444444','Sofia','${phone}',900000,
  'monthly'::lease_cycle, date '2026-02-01', 0, null)`);
await db.exec(`update wa_conversations set active_ticket_id=null, state='idle' where phone_e164='${phone}'`);

const ambiguous = await route("la porte est cassée");
check("two tenancies means asking which flat", ambiguous.decision === "ask",
  `${ambiguous.lease_count} active leases`);

await db.query(`select wa_set_state('${await conversation()}','awaiting_apartment','la porte est cassée',null)`);
const answered = await route("2A");
check("the reply is read as the answer", answered.decision === "answer");
check("what they already typed is not asked for twice",
  answered.report === "la porte est cassée", `kept: ${answered.report}`);

/* ------------------------------------------------------------- strangers */

const stranger = (await db.query(
  `select decision from wa_route_inbound('+224600000000','hello')`
)).rows[0];
check("an unknown number is not recognised", stranger.decision === "unknown",
  "and the webhook answers it with silence");

/* ------------------------------------------------------------- staleness */

await db.exec(`update wa_conversations
  set active_ticket_id='${ticket}', state='idle', state_changed_at = now() - interval '7 days'
  where phone_e164='${phone}'`);
check("a week later is a new report, not a follow up",
  (await route("nouveau problème")).decision !== "attach",
  "an old open ticket must not swallow next month's problem");

/* ------------------------------------------------- the reply text itself */

const webhook = await readFile(
  path.join(process.cwd(), "app", "api", "webhooks", "whatsapp", "route.ts"),
  "utf8"
);
check("the tenant is told their reference",
  /référence \$\{ref\}/.test(webhook) || /reference \$\{ref\}/.test(webhook),
  "so they can quote it when they ring");
check("a caption counts as the report",
  /image\?\.caption/.test(webhook),
  "a photo with a sentence under it is the commonest report");
check("an unrecognised unit is asked again rather than guessed",
  /didNotCatchUnit/.test(webhook));

await db.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
