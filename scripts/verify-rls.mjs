/**
 * Exercises the schema the way the app will: two agencies, two users, and the
 * money functions. Runs as the `authenticated` role so RLS is actually enforced
 * (superusers bypass it, which would make the test meaningless).
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const db = new PGlite({ extensions: { citext, pgcrypto } });
const q = async (sql, params) => (await db.query(sql, params)).rows;

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
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/') $$;
`);

const dir = path.join(process.cwd(), "supabase", "migrations");
for (const f of (await readdir(dir)).filter((x) => x.endsWith(".sql")).sort()) {
  await db.exec(await readFile(path.join(dir, f), "utf8"));
}

// Grant the authenticated role what Supabase grants it.
await db.exec(`
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
`);

const [userA] = await q(`insert into auth.users (email) values ('amina@horizon.gn') returning id`);
const [userB] = await q(`insert into auth.users (email) values ('rival@other.gn') returning id`);

const asUser = async (id, sql, params) => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}';`);
  const rows = params ? await q(sql, params) : await q(sql);
  await db.exec(`reset role; reset request.jwt.claim.sub;`);
  return rows;
};

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// --- agency creation via the signup RPC
const [a1] = await asUser(userA.id, `select public.create_agency_for_current_user('Horizon Realty','Guinea','Conakry','GNF','fr','Amina Sow') as id`);
const [a2] = await asUser(userB.id, `select public.create_agency_for_current_user('Rival Immo') as id`);
check("signup RPC creates agency + owner membership + trial subscription", !!a1.id && !!a2.id);

const [sub] = await asUser(userA.id, `select plan, status from subscriptions where agency_id = '${a1.id}'`);
check("new agency starts on a 30 day trial", sub?.status === "trialing", `plan=${sub?.plan} status=${sub?.status}`);

const [rules] = await asUser(userA.id, `select count(*)::int as n from reminder_rules where agency_id = '${a1.id}'`);
check("default WhatsApp reminder cadence seeded", rules.n === 4, `${rules.n} rules`);

// --- buildings, and the plan limit
const [bA] = await asUser(userA.id, `
  insert into buildings (agency_id, name, address, city, market_value)
  values ('${a1.id}', 'Résidence Les Palmiers', '14 Avenue des Palmiers', 'Kaloum', 1200000)
  returning id`);
const [bB] = await asUser(userB.id, `
  insert into buildings (agency_id, name, city) values ('${a2.id}', 'Immeuble Rival', 'Matam') returning id`);
check("members can create buildings in their own agency", !!bA.id && !!bB.id);

// --- the isolation test that matters
const visibleToA = await asUser(userA.id, `select name from buildings order by name`);
check(
  "agency A cannot see agency B's buildings",
  visibleToA.length === 1 && visibleToA[0].name === "Résidence Les Palmiers",
  `A sees: ${visibleToA.map((r) => r.name).join(", ")}`
);

let crossTenantWriteBlocked = false;
try {
  await asUser(userB.id, `update buildings set name = 'Hijacked' where id = '${bA.id}'`);
  const [after] = await asUser(userA.id, `select name from buildings where id = '${bA.id}'`);
  crossTenantWriteBlocked = after.name === "Résidence Les Palmiers";
} catch {
  crossTenantWriteBlocked = true;
}
check("agency B cannot modify agency A's building", crossTenantWriteBlocked);

// --- apartments and leases
const [apt] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Apt 1A', 3, 2, 92, 1450000) returning id`);
const [lease] = await asUser(userA.id, `
  select public.create_lease('${apt.id}', 'Mariam Diallo', '+224620112233', 1450000, 'monthly', date '2026-08-01') as id`);
check("create_lease makes resident + lease + first charge", !!lease.id);

const charges = await asUser(userA.id, `select amount, due_on, status from rent_charges where lease_id = '${lease.id}'`);
check("first rent charge generated for the period", charges.length === 1 && Number(charges[0].amount) === 1450000);

// --- partial then full payment
await asUser(userA.id, `select public.record_payment('${lease.id}', 450000, 'orange_money', date '2026-08-05')`);
const [partial] = await asUser(userA.id, `select state, paid_amount, balance from v_charge_status where lease_id = '${lease.id}'`);
// The 1 Aug due date is in the past, so an unsettled charge is correctly overdue.
check(
  "partial payment leaves a balance and is not settled",
  ["pending", "overdue"].includes(partial.state) &&
    Number(partial.paid_amount) === 450000 &&
    Number(partial.balance) === 1000000,
  `state=${partial.state} paid=${partial.paid_amount} balance=${partial.balance}`
);

await asUser(userA.id, `select public.record_payment('${lease.id}', 1000000, 'cash', date '2026-08-08')`);
const [settled] = await asUser(userA.id, `select state, balance from v_charge_status where lease_id = '${lease.id}'`);
check("paying the remainder settles the charge", settled.state === "paid" && Number(settled.balance) === 0, `state=${settled.state}`);

// --- apartment state view drives the UI
const [state] = await asUser(userA.id, `select label, is_occupied, resident_name, rent_state from v_apartment_state where apartment_id = '${apt.id}'`);
check(
  "v_apartment_state reports occupancy and rent state",
  state.is_occupied === true && state.resident_name === "Mariam Diallo" && state.rent_state === "paid",
  `occupied=${state.is_occupied} rent=${state.rent_state}`
);

// --- tickets and the resolve function booking an expense
const [ticket] = await asUser(userA.id, `
  insert into tickets (agency_id, building_id, apartment_id, title, reported_via)
  values ('${a1.id}', '${bA.id}', '${apt.id}', 'Fuite du robinet de cuisine', 'whatsapp') returning id`);
await asUser(userA.id, `select public.resolve_ticket('${ticket.id}', 85000)`);
const [tk] = await asUser(userA.id, `select status, cost, resolved_at is not null as has_time from tickets where id = '${ticket.id}'`);
const [exp] = await asUser(userA.id, `select count(*)::int as n, coalesce(sum(amount),0)::bigint as total from expenses where ticket_id = '${ticket.id}'`);
check(
  "resolve_ticket closes it and books the cost as an expense",
  tk.status === "resolved" && tk.has_time && exp.n === 1 && Number(exp.total) === 85000,
  `status=${tk.status} expense=${exp.total}`
);

// --- ROI view needs a valuation, and computes from real money
const [perf] = await asUser(userA.id, `
  select apartment_count, occupied_count, income_ytd, expenses_ytd, net_yield_pct
  from v_building_performance where building_id = '${bA.id}'`);
check(
  "v_building_performance computes yield from payments minus expenses",
  Number(perf.income_ytd) === 1450000 && Number(perf.expenses_ytd) === 85000 && perf.net_yield_pct !== null,
  `income=${perf.income_ytd} expenses=${perf.expenses_ytd} yield=${perf.net_yield_pct}%`
);

// --- audit trail
const [audit] = await asUser(userA.id, `select count(*)::int as n from audit_log where agency_id = '${a1.id}'`);
check("money changes are written to the audit log", audit.n > 0, `${audit.n} entries`);

// --- plan limit: growth allows 5 buildings
let limitHeld = false;
try {
  for (let i = 0; i < 6; i++) {
    await asUser(userA.id, `insert into buildings (agency_id, name, city) values ('${a1.id}', 'Extra ${i}', 'Conakry')`);
  }
} catch (err) {
  limitHeld = /plan limit reached/.test(err.message);
}
const [count] = await asUser(userA.id, `select count(*)::int as n from buildings where agency_id = '${a1.id}'`);
check("plan limit stops the 6th building on Growth", limitHeld && count.n === 5, `${count.n} buildings, error raised=${limitHeld}`);

// --- technicians, reassignment and performance
const [techA] = await asUser(userA.id, `
  insert into technicians (agency_id, full_name, trade, phone_e164)
  values ('${a1.id}', 'B. Keita', 'plombier', '+224620400001') returning id`);
const [techB] = await asUser(userA.id, `
  insert into technicians (agency_id, full_name, trade, phone_e164)
  values ('${a1.id}', 'S. Diop', 'serrurier', '+224620400002') returning id`);

const [t2] = await asUser(userA.id, `
  insert into tickets (agency_id, building_id, title, reported_via)
  values ('${a1.id}', '${bA.id}', 'Serrure du portail bloquée', 'whatsapp') returning id`);

await asUser(userA.id, `select public.assign_technician('${t2.id}', '${techA.id}', 40000)`);
const [assigned] = await asUser(userA.id, `select technician_id, status, cost from tickets where id = '${t2.id}'`);
check("assign_technician sets the technician and moves the ticket to assigned",
  assigned.technician_id === techA.id && assigned.status === "assigned" && Number(assigned.cost) === 40000);

await asUser(userA.id, `select public.assign_technician('${t2.id}', '${techB.id}')`);
const [reassigned] = await asUser(userA.id, `select technician_id from tickets where id = '${t2.id}'`);
const trail = await asUser(userA.id, `select body from ticket_messages where ticket_id = '${t2.id}' order by created_at`);
check("a ticket can be reassigned, and the handover is recorded",
  reassigned.technician_id === techB.id && trail.length === 2 && /Réassigné/.test(trail[1].body),
  trail.map((r) => r.body).join(" then "));

let crossAgencyTech = false;
try {
  const [otherTech] = await asUser(userB.id, `
    insert into technicians (agency_id, full_name) values ('${a2.id}', 'Outsider') returning id`);
  await asUser(userA.id, `select public.assign_technician('${t2.id}', '${otherTech.id}')`);
} catch (err) {
  crossAgencyTech = /not in this agency/.test(err.message);
}
check("a technician from another agency cannot be assigned", crossAgencyTech);

await asUser(userA.id, `select public.resolve_ticket('${t2.id}', 60000)`);
const [perfTech] = await asUser(userA.id, `
  select full_name, jobs_total, jobs_resolved, total_paid
  from v_technician_performance where technician_id = '${techB.id}'`);
check("v_technician_performance counts jobs and money paid",
  Number(perfTech.jobs_total) === 1 && Number(perfTech.jobs_resolved) === 1 && Number(perfTech.total_paid) === 60000,
  `${perfTech.full_name}: ${perfTech.jobs_resolved} resolved, ${perfTech.total_paid} paid`);

// --- apartment photo gallery keeps its order contiguous
for (const [i, name] of ["a.jpg", "b.jpg", "c.jpg"].entries()) {
  await asUser(userA.id, `
    insert into apartment_photos (agency_id, apartment_id, storage_path, position)
    values ('${a1.id}', '${apt.id}', '${a1.id}/${apt.id}/${name}', ${i})`);
}
await asUser(userA.id, `delete from apartment_photos where storage_path like '%a.jpg'`);
const positions = await asUser(userA.id, `
  select position from apartment_photos where apartment_id = '${apt.id}' order by position`);
check("deleting a photo renumbers the gallery without gaps",
  positions.map((r) => Number(r.position)).join(",") === "0,1",
  `positions: ${positions.map((r) => r.position).join(",")}`);

const photosVisibleToB = await asUser(userB.id, `select count(*)::int as n from apartment_photos`);
check("photos are invisible to another agency", photosVisibleToB[0].n === 0);

/* ------------------------------------------------- reminder idempotency --
 * The reminder cron runs once a day and fires a rule as soon as its offset has
 * been reached, so it will retry the same charge on later days. The unique
 * constraint is the only thing stopping a tenant being messaged twice.
 */
const [charge] = await asUser(userA.id, `
  select rc.id from rent_charges rc
  join leases l on l.id = rc.lease_id
  where rc.agency_id = '${a1.id}' limit 1`);
const [rule] = await asUser(userA.id, `
  select id, channel from reminder_rules where agency_id = '${a1.id}' limit 1`);

const claim = () => asUser(userA.id, `
  insert into reminder_events (agency_id, rent_charge_id, rule_id, channel, status)
  values ('${a1.id}', '${charge.id}', '${rule.id}', '${rule.channel}', 'queued')`);

await claim();
let secondClaimRejected = false;
try {
  await claim();
} catch {
  secondClaimRejected = true;
}
check("the same reminder cannot be sent twice for a charge", secondClaimRejected);

const [sent] = await asUser(userA.id, `
  select count(*)::int as n from reminder_events
  where rent_charge_id = '${charge.id}' and rule_id = '${rule.id}'`);
check("exactly one reminder event survives the retry", sent.n === 1, `${sent.n} rows`);

await db.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
