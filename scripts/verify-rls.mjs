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
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
  raw_user_meta_data jsonb);
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
const [manager] = await q(`insert into auth.users (email) values ('karim@horizonrealty.gn') returning id`);

const asUser = async (id, sql, params) => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}';`);
  try {
    return params ? await q(sql, params) : await q(sql);
  } finally {
    // A refused statement is often the point of the test. The session has
    // to come back as itself either way, or the next superuser statement
    // runs as `authenticated` and fails for a reason nobody was testing.
    await db.exec(`reset role; reset request.jwt.claim.sub;`);
  }
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

// --- buildings are not restricted. A tier is a band of apartments, and the
// apartment ceiling is exercised further down with an agency built for it.
for (let i = 0; i < 6; i++) {
  await asUser(userA.id, `insert into buildings (agency_id, name, city) values ('${a1.id}', 'Extra ${i}', 'Conakry')`);
}
const [count] = await asUser(userA.id, `select count(*)::int as n from buildings where agency_id = '${a1.id}'`);
check("buildings are not capped by the plan", count.n === 7, `${count.n} buildings`);

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

/* ------------------------------------------------- guards in the database --
 * These used to live only in the server action, which meant they held for the
 * dashboard and not for anyone calling PostgREST with their own token.
 */
const [guardApt] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Apt Guard', 1, 1, 30, 400000) returning id`);
await asUser(userA.id, `
  select public.create_lease('${guardApt.id}', 'Sekou Camara', '+224620555111',
    400000, 'monthly', date '2026-01-01')`);

let occupiedDeleteBlocked = false;
try {
  await asUser(userA.id, `delete from apartments where id = '${guardApt.id}'`);
} catch {
  occupiedDeleteBlocked = true;
}
check("the database refuses to delete an occupied apartment", occupiedDeleteBlocked);

const [stillThere] = await asUser(userA.id, `
  select count(*)::int as n from apartments where id = '${guardApt.id}'`);
check("the occupied apartment and its history survive", stillThere.n === 1);

// Ending the lease should release it.
await asUser(userA.id, `
  update leases set status = 'ended' where apartment_id = '${guardApt.id}'`);
await asUser(userA.id, `delete from apartments where id = '${guardApt.id}'`);
const [nowGone] = await asUser(userA.id, `
  select count(*)::int as n from apartments where id = '${guardApt.id}'`);
check("once the lease is ended the unit can be deleted", nowGone.n === 0);

/* ----------------------------------------------------------- rate limiting */
const [first] = await q(`select public.take_rate_limit('test-bucket', 3, 60) as ok`);
check("the first hit inside the limit is allowed", first.ok === true);
await q(`select public.take_rate_limit('test-bucket', 3, 60)`);
const [third] = await q(`select public.take_rate_limit('test-bucket', 3, 60) as ok`);
check("the last hit inside the limit is allowed", third.ok === true);
const [fourth] = await q(`select public.take_rate_limit('test-bucket', 3, 60) as ok`);
check("the hit past the limit is refused", fourth.ok === false);

// A stale window starts over rather than staying blocked forever.
await q(`update rate_limits set window_start = now() - interval '2 minutes' where bucket = 'test-bucket'`);
const [afterWindow] = await q(`select public.take_rate_limit('test-bucket', 3, 60) as ok`);
check("a new window resets the counter", afterWindow.ok === true);

/* ------------------------------------------------------- edit and delete --
 * The CRUD the interface offers has to hold at the database too: a unit is
 * editable, a tenant's own row is correctable, and an occupied unit must not
 * quietly take its payment history down with it.
 */
const [editApt] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Apt Edit', 1, 1, 30, 500000) returning id`);

await asUser(userA.id, `
  update apartments set label = 'Apt Edited', base_rent = 650000 where id = '${editApt.id}'`);
const [edited] = await asUser(userA.id, `
  select label, base_rent::int from apartments where id = '${editApt.id}'`);
check("an apartment can be edited", edited.label === "Apt Edited" && edited.base_rent === 650000,
  `${edited.label} at ${edited.base_rent}`);

let rivalEditBlocked = false;
try {
  await asUser(userB.id, `update apartments set label = 'Stolen' where id = '${editApt.id}'`);
  const [after] = await asUser(userA.id, `select label from apartments where id = '${editApt.id}'`);
  rivalEditBlocked = after.label === "Apt Edited";
} catch {
  rivalEditBlocked = true;
}
check("another agency cannot edit that apartment", rivalEditBlocked);

await asUser(userA.id, `delete from apartments where id = '${editApt.id}'`);
const [goneCount] = await asUser(userA.id, `
  select count(*)::int as n from apartments where id = '${editApt.id}'`);
check("a vacant apartment can be deleted", goneCount.n === 0);

// A tenant's name and number live on the resident row.
const [resident] = await asUser(userA.id, `
  select id from residents where agency_id = '${a1.id}' limit 1`);
await asUser(userA.id, `
  update residents set full_name = 'Mariam D. Corrected' where id = '${resident.id}'`);
const [renamed] = await asUser(userA.id, `
  select full_name from residents where id = '${resident.id}'`);
check("a tenant's details can be corrected", renamed.full_name === "Mariam D. Corrected");

let rivalResidentBlocked = false;
try {
  await asUser(userB.id, `update residents set full_name = 'Hijacked' where id = '${resident.id}'`);
  const [after] = await asUser(userA.id, `select full_name from residents where id = '${resident.id}'`);
  rivalResidentBlocked = after.full_name === "Mariam D. Corrected";
} catch {
  rivalResidentBlocked = true;
}
check("another agency cannot rename that tenant", rivalResidentBlocked);

// Ending a lease must keep the money it collected.
const [endMe] = await asUser(userA.id, `select id from leases where agency_id = '${a1.id}' limit 1`);
const [chargesBefore] = await asUser(userA.id, `
  select count(*)::int as n from rent_charges where lease_id = '${endMe.id}'`);
await asUser(userA.id, `
  update leases set status = 'ended', ends_on = current_date where id = '${endMe.id}'`);
const [chargesAfter] = await asUser(userA.id, `
  select count(*)::int as n from rent_charges where lease_id = '${endMe.id}'`);
check("ending a lease keeps its payment history",
  chargesBefore.n === chargesAfter.n && chargesBefore.n > 0,
  `${chargesBefore.n} charges before, ${chargesAfter.n} after`);

/* ----------------------------------------------------- lease end date --
 * ends_on has to survive the round trip and refuse an impossible range,
 * because the only guard against a typo is the database.
 */
const [fixedApt] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Apt Fixed', 2, 1, 60, 900000) returning id`);

const [fixedLease] = await asUser(userA.id, `
  select public.create_lease('${fixedApt.id}', 'Fatou Camara', '+224620998877',
    900000, 'monthly', date '2026-09-01', 0, date '2027-08-31') as id`);
const [ends] = await asUser(userA.id, `
  select ends_on::text from leases where id = '${fixedLease.id}'`);
check("create_lease stores the move out date", ends.ends_on === "2027-08-31", ends.ends_on);

const [stateRow] = await asUser(userA.id, `
  select lease_ends_on::text from v_apartment_state where apartment_id = '${fixedApt.id}'`);
check("v_apartment_state exposes lease_ends_on",
  stateRow.lease_ends_on === "2027-08-31", stateRow.lease_ends_on);

let backwardsRejected = false;
try {
  await asUser(userA.id, `
    select public.create_lease('${fixedApt.id}', 'Backwards Lease', '+224620111000',
      900000, 'monthly', date '2026-09-01', 0, date '2026-01-01')`);
} catch {
  backwardsRejected = true;
}
check("a lease ending before it starts is refused", backwardsRejected);

/* ------------------------------------------------- settings: member list --
 * list_agency_members bridges auth.users, which PostgREST cannot reach
 * directly. It must return the email and it must refuse a non member.
 */
const membersOfA = await asUser(userA.id, `select * from list_agency_members('${a1.id}')`);
check("list_agency_members returns the roster with email",
  membersOfA.length >= 1 && membersOfA.every((m) => m.email),
  `${membersOfA.length} member(s)`);

let refusedForOutsider = false;
try {
  await asUser(userB.id, `select * from list_agency_members('${a1.id}')`);
} catch {
  refusedForOutsider = true;
}
check("list_agency_members refuses a caller outside the agency", refusedForOutsider);



/* ------------------------------------------ a price agreed with a tenant --
 * The unit carries an asking price, but what a tenant actually pays is a
 * negotiation. The lease has to be able to disagree with the apartment, and
 * everything downstream must follow the lease rather than the asking price.
 */
const [negotiated] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Apt 4C', 2, 1, 64, 1000000) returning id`);
const [dealLease] = await asUser(userA.id, `
  select public.create_lease('${negotiated.id}', 'Sekou Camara', '+224620998877', 850000, 'monthly', date '2026-08-01') as id`);

const [dealCharge] = await asUser(userA.id,
  `select amount from rent_charges where lease_id = '${dealLease.id}'`);
check("the charge follows the agreed rent, not the asking price",
  Number(dealCharge.amount) === 850000, `${dealCharge.amount} billed on a 1 000 000 unit`);

const [dealState] = await asUser(userA.id,
  `select base_rent, rent_amount from v_apartment_state where apartment_id = '${negotiated.id}'`);
check("the unit keeps its asking price alongside the agreed one",
  Number(dealState.base_rent) === 1000000 && Number(dealState.rent_amount) === 850000,
  `asking ${dealState.base_rent}, agreed ${dealState.rent_amount}`);

/* --------------------------------------- your own name, and whose agency --
 * A manager is somebody the owner invited in. They run the portfolio; they do
 * not own the business, so the agency's identity is out of their reach. Their
 * own name is not: everyone sets that for themselves. The interesting case is
 * that setting it must not become a way to set anything else.
 */
await asUser(userA.id, `
  insert into memberships (user_id, agency_id, role, full_name)
  values ('${manager.id}', '${a1.id}', 'manager', 'Karim')`);

await asUser(manager.id, `select public.set_my_display_name('${a1.id}', 'Karim Diallo')`);
const [namedSelf] = await asUser(manager.id,
  `select full_name, role from memberships where user_id = '${manager.id}'`);
check("a manager can set their own name",
  namedSelf.full_name === "Karim Diallo", namedSelf.full_name);
check("setting a name cannot change the role",
  namedSelf.role === "manager", `role stayed ${namedSelf.role}`);

// The owner's row must be untouched by the manager naming themselves.
const [ownerMembership] = await asUser(userA.id,
  `select full_name from memberships where user_id = '${userA.id}'`);
check("naming yourself does not rename a colleague",
  ownerMembership.full_name === "Amina Sow", ownerMembership.full_name);

// The direct route to the same column stays shut, which is what stops a
// manager writing role alongside it.
let directRenameBlocked = false;
await asUser(manager.id,
  `update memberships set role = 'owner' where user_id = '${manager.id}'`);
const [afterEscalation] = await asUser(manager.id,
  `select role from memberships where user_id = '${manager.id}'`);
directRenameBlocked = afterEscalation.role === "manager";
check("a manager cannot promote themselves to owner",
  directRenameBlocked, `role is ${afterEscalation.role}`);

let outsiderNameBlocked = false;
try {
  await asUser(userB.id, `select public.set_my_display_name('${a1.id}', 'Intruder')`);
} catch {
  outsiderNameBlocked = true;
}
check("set_my_display_name refuses a caller outside the agency", outsiderNameBlocked);

await asUser(manager.id, `update agencies set name = 'Karim Immo' where id = '${a1.id}'`);
const [agencyNameAfter] = await asUser(userA.id, `select name, whatsapp_number from agencies where id = '${a1.id}'`);
check("a manager cannot rename the agency",
  agencyNameAfter.name === "Horizon Realty", agencyNameAfter.name);

await asUser(manager.id, `update agencies set whatsapp_number = '+224000000000' where id = '${a1.id}'`);
const [agencyWaAfter] = await asUser(userA.id, `select whatsapp_number from agencies where id = '${a1.id}'`);
check("a manager cannot change the agency WhatsApp number",
  agencyWaAfter.whatsapp_number !== "+224000000000", String(agencyWaAfter.whatsapp_number));

await asUser(userA.id, `update agencies set name = 'Horizon Realty Group' where id = '${a1.id}'`);
const [agencyOwnerEdit] = await asUser(userA.id, `select name from agencies where id = '${a1.id}'`);
check("the owner can still rename the agency",
  agencyOwnerEdit.name === "Horizon Realty Group", agencyOwnerEdit.name);


/* ------------------------------------------- what a colleague is shown --
 * Navigation, not security: RLS still decides what the data gives up. But the
 * middleware closes routes using this column, so it has to be right, and the
 * one function an owner uses to tidy a menu must never be a way to promote
 * somebody or to lock the last owner out of their own agency.
 */
const caretaker = await q(`insert into auth.users (email) values ('fatou@horizonrealty.gn') returning id`);
await asUser(userA.id, `
  insert into memberships (user_id, agency_id, role, full_name)
  values ('${caretaker[0].id}', '${a1.id}', 'caretaker', 'Fatou')`);

const [caretakerPages] = await asUser(userA.id,
  `select allowed_pages from memberships where user_id = '${caretaker[0].id}'`);
check("a caretaker starts on the jobs, not the money",
  caretakerPages.allowed_pages.includes("maintenance") &&
  !caretakerPages.allowed_pages.includes("rent"),
  caretakerPages.allowed_pages.join(", "));

const [ownerPages] = await asUser(userA.id,
  `select allowed_pages from memberships where user_id = '${userA.id}'`);
check("an owner starts with everything",
  ownerPages.allowed_pages.length === 4, ownerPages.allowed_pages.join(", "));

await asUser(userA.id,
  `select public.set_member_pages('${a1.id}', '${caretaker[0].id}', array['dashboard','apartments'])`);
const [narrowed] = await asUser(userA.id,
  `select allowed_pages, role from memberships where user_id = '${caretaker[0].id}'`);
check("an owner can change what a colleague sees",
  narrowed.allowed_pages.join(",") === "dashboard,apartments", narrowed.allowed_pages.join(","));
check("changing pages cannot change the role",
  narrowed.role === "caretaker", `role stayed ${narrowed.role}`);

let caretakerBlocked = false;
try {
  await asUser(caretaker[0].id,
    `select public.set_member_pages('${a1.id}', '${manager.id}', array['dashboard'])`);
} catch {
  caretakerBlocked = true;
}
check("a caretaker cannot rewrite anybody's menu", caretakerBlocked);

let selfBlocked = false;
try {
  await asUser(userA.id,
    `select public.set_member_pages('${a1.id}', '${userA.id}', array['dashboard'])`);
} catch {
  selfBlocked = true;
}
check("an owner cannot narrow their own access", selfBlocked,
  "otherwise the last owner could lock themselves out");

let unknownPageBlocked = false;
try {
  await asUser(userA.id,
    `select public.set_member_pages('${a1.id}', '${caretaker[0].id}', array['payroll'])`);
} catch {
  unknownPageBlocked = true;
}
check("a page that does not exist is refused", unknownPageBlocked,
  "a typo would silently hide a link instead");

// The roster the settings page reads has to carry it, or the interface cannot
// show what it is about to change.
const roster = await asUser(userA.id, `select * from list_agency_members('${a1.id}')`);
check("the roster carries each colleague's pages",
  roster.every((m) => Array.isArray(m.allowed_pages)), `${roster.length} member(s)`);


/* ------------------------------------------------ money always lands --
 * A payment that allocates to nothing is money in the books and invisible on
 * the schedule. It happened whenever a tenant who was already straight handed
 * over more: the only period the payment could reach was the current one, and
 * that was settled. Every franc has to end up against a period.
 */
const [aptPay] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Pay 1', 2, 1, 50, 1000000) returning id`);
const [leasePay] = await asUser(userA.id, `
  select public.create_lease('${aptPay.id}', 'Ahead', '+224620000777',
    1000000, 'monthly'::lease_cycle, date '2026-08-01', 1, null) as id`);

const allocated = async () => {
  const [row] = await asUser(userA.id, `
    select coalesce(sum(p.amount),0)::bigint as received,
           coalesce((select sum(pa.amount) from payment_allocations pa
                     join payments p2 on p2.id = pa.payment_id
                     where p2.lease_id = '${leasePay.id}'), 0)::bigint as allocated
    from payments p where p.lease_id = '${leasePay.id}'`);
  return { received: Number(row.received), allocated: Number(row.allocated) };
};

await asUser(userA.id, `select public.record_payment('${leasePay.id}', 1000000, 'cash', date '2026-08-05')`);
let money = await allocated();
check("a payment settles the period it is for",
  money.received === money.allocated, `${money.allocated} of ${money.received}`);

await asUser(userA.id, `select public.record_payment('${leasePay.id}', 1000000, 'cash', date '2026-08-06')`);
money = await allocated();
check("paying while already straight rolls to the next period",
  money.received === money.allocated && money.received === 2000000,
  `${money.allocated} of ${money.received} allocated`);

const ahead = await asUser(userA.id, `
  select period_start, state from v_charge_status
  where lease_id = '${leasePay.id}' order by period_start`);
check("the next period is raised and marked paid",
  ahead.length === 2 && ahead.every((r) => r.state === "paid"),
  ahead.map((r) => String(r.period_start).slice(0, 10)).join(", "));

await asUser(userA.id, `select public.record_payment('${leasePay.id}', 2500000, 'cash', date '2026-08-07')`);
money = await allocated();
check("an amount that is not whole periods still allocates fully",
  money.received === money.allocated, `${money.allocated} of ${money.received}`);

/* --------------------------------------------------------- half years -- */

const [aptSem] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Sem 1', 2, 1, 50, 3000000) returning id`);
await asUser(userA.id, `
  select public.create_lease('${aptSem.id}', 'Half', '+224620000888',
    3000000, 'semester'::lease_cycle, date '2026-09-03', 1, null)`);
const [semester] = await asUser(userA.id, `
  select period_start, period_end from rent_charges
  where lease_id = (select id from leases where apartment_id = '${aptSem.id}')`);
// The driver hands dates back as Date objects, so these are compared by
// month and day rather than by slicing a string that is not ISO.
const iso = (d) => new Date(d).toISOString().slice(5, 10);
check("a September half year bills July to December",
  iso(semester.period_start) === "07-01" && iso(semester.period_end) === "12-31",
  `${iso(semester.period_start)} to ${iso(semester.period_end)}`);


/* ------------------------------------------- the tenant you typed --------
 * Adding a tenant showed somebody else's name. create_lease matched a
 * resident by phone and then discarded the name that had just been entered,
 * so an agency reusing a number got the previous tenant back with nothing
 * said about it. The number stays the identity, because the WhatsApp webhook
 * finds a tenant by the number they message from, but the name has to follow
 * what was typed.
 */
const [aptOne] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Ident 1', 1, 1, 30, 500000) returning id`);
const [aptTwo] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Ident 2', 1, 1, 30, 500000) returning id`);

await asUser(userA.id, `select public.create_lease('${aptOne.id}', 'First Tenant',
  '+224620555001', 500000, 'monthly'::lease_cycle, date '2026-08-01', 0, null)`);
await asUser(userA.id, `select public.create_lease('${aptTwo.id}', 'Second Tenant',
  '+224620555001', 500000, 'monthly'::lease_cycle, date '2026-08-01', 0, null)`);

const [second] = await asUser(userA.id, `
  select r.full_name from v_apartment_state s
  join residents r on r.id = s.resident_id
  where s.apartment_id = '${aptTwo.id}'`);
check("the name entered is the name shown",
  second.full_name === "Second Tenant", `shows ${second.full_name}`);

const sharedPhone = await asUser(userA.id, `
  select count(*)::int as n from residents
  where agency_id = '${a1.id}' and phone_e164 = '+224620555001'`);
check("one number stays one person",
  sharedPhone[0].n === 1,
  "two residents on one number would make WhatsApp routing ambiguous");

// A tenant with no number at all has to be possible, and two of them must not
// collapse into each other.
await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'NoPhone 1', 1, 1, 30, 400000)`);
const [aptNo1] = await asUser(userA.id,
  `select id from apartments where label = 'NoPhone 1' and agency_id = '${a1.id}'`);
await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'NoPhone 2', 1, 1, 30, 400000)`);
const [aptNo2] = await asUser(userA.id,
  `select id from apartments where label = 'NoPhone 2' and agency_id = '${a1.id}'`);

let blankWorks = true;
try {
  await asUser(userA.id, `select public.create_lease('${aptNo1.id}', 'No Number One',
    null, 400000, 'monthly'::lease_cycle, date '2026-08-01', 0, null)`);
  await asUser(userA.id, `select public.create_lease('${aptNo2.id}', 'No Number Two',
    null, 400000, 'monthly'::lease_cycle, date '2026-08-01', 0, null)`);
} catch {
  blankWorks = false;
}
check("a tenant without a phone can be added", blankWorks);

const [noPhoneTwo] = await asUser(userA.id, `
  select r.full_name from v_apartment_state s
  join residents r on r.id = s.resident_id
  where s.apartment_id = '${aptNo2.id}'`);
check("two tenants without phones stay two people",
  noPhoneTwo?.full_name === "No Number Two", `shows ${noPhoneTwo?.full_name}`);

let namelessRefused = false;
try {
  await asUser(userA.id, `select public.create_lease('${aptOne.id}', '   ',
    '+224620555009', 500000, 'monthly'::lease_cycle, date '2026-08-01', 0, null)`);
} catch {
  namelessRefused = true;
}
check("a lease with no tenant name is refused", namelessRefused);

const lookup = await asUser(userA.id,
  `select full_name from resident_by_phone('${a1.id}', '+224620555001')`);
check("the form can ask who a number belongs to",
  lookup[0]?.full_name === "Second Tenant", lookup[0]?.full_name);


/* ------------------------------------------ one person, two agencies ----
 * A person can belong to more than one agency, and the database has always
 * said so: a membership is a person and an agency rather than a column on
 * either. What matters is that row level security answers with both, because
 * the application picks one of them and filters by it. If RLS answered with
 * only the first, the switcher would have nothing to switch to; if the
 * application forgot to filter, both portfolios would arrive shuffled.
 */
const [a3] = await asUser(userA.id, `
  select public.create_agency_for_current_user('Second Agency','Guinea','Kankan','GNF','fr','Amina Sow') as id`);

const bothAgencies = await asUser(userA.id, `select id, name from agencies order by name`);
check("row level security answers with every agency they belong to",
  bothAgencies.length === 2, bothAgencies.map((a) => a.name).join(", "));

const [bC] = await asUser(userA.id, `
  insert into buildings (agency_id, name, address, city)
  values ('${a3.id}', 'Kankan Court', '1 Rue Neuve', 'Kankan') returning id`);

// Unfiltered is what the application used to do, and is now the bug this
// guards: it returns both portfolios at once.
const unfiltered = await asUser(userA.id, `select name from buildings`);
check("asking without an agency returns both portfolios",
  unfiltered.length >= 2,
  "which is why every portfolio query names one");

const scoped = await asUser(userA.id,
  `select name from buildings where agency_id = '${a3.id}'`);
check("asking for one agency returns only its buildings",
  scoped.length === 1 && scoped[0].name === "Kankan Court",
  scoped.map((b) => b.name).join(", "));

// The second agency arrives furnished the way signup furnishes the first.
const [sub3] = await asUser(userA.id,
  `select plan, status from subscriptions where agency_id = '${a3.id}'`);
check("a second agency gets its own trial", Boolean(sub3), `${sub3?.plan} / ${sub3?.status}`);

const [rules3] = await asUser(userA.id,
  `select count(*)::int as n from reminder_rules where agency_id = '${a3.id}'`);
check("a second agency gets its own reminder cadence", rules3.n > 0, `${rules3.n} rules`);

const [own3] = await asUser(userA.id,
  `select role from memberships where agency_id = '${a3.id}' and user_id = '${userA.id}'`);
check("the person creating it owns it", own3?.role === "owner", own3?.role);

// And none of it reaches the other agency's members.
let outsiderBlocked = true;
const seenByB = await asUser(userB.id, `select name from buildings where agency_id = '${a3.id}'`);
outsiderBlocked = seenByB.length === 0;
check("a second agency is invisible to somebody outside it", outsiderBlocked,
  `${seenByB.length} rows leaked`);

/* ------------------------------------------------------ the pricing model --
 * Three tiers, each a band of apartments, priced per country. The ceiling is
 * the one thing a tier restricts, and it is enforced in the database so it
 * holds whatever the client says.
 */
const tiers = await asUser(userA.id, `select code, min_apartments, max_apartments from plans order by rank`);
check("three tiers, in order",
  tiers.map((t) => t.code).join(",") === "starter,growth,business",
  tiers.map((t) => t.code).join(","));
const contiguous = tiers.every((t, i) =>
  i === 0 ? t.min_apartments === 1 : t.min_apartments === tiers[i - 1].max_apartments + 1);
check("the bands are contiguous, start at one and stop at two hundred and fifty",
  contiguous && tiers[tiers.length - 1].max_apartments === 250,
  tiers.map((t) => `${t.min_apartments}..${t.max_apartments ?? "∞"}`).join(" "));

const prices = await asUser(userA.id, `select plan, country, currency, monthly, annual from plan_prices order by country, plan`);
const gn = prices.filter((p) => p.country === "Guinea");
const cm = prices.filter((p) => p.country === "Cameroon");
check("a full list for each country, in its own currency",
  gn.length === 3 && cm.length === 3 && gn.every((p) => p.currency === "GNF") && cm.every((p) => p.currency === "XAF"),
  `${gn.length} GNF rows, ${cm.length} XAF rows`);
check("a year is ten months, everywhere",
  prices.filter((p) => p.monthly !== null).every((p) => Number(p.annual) === Number(p.monthly) * 10),
  "two months free on every tier");
check("Guinea Professional is 450 000 GNF a month",
  Number(gn.find((p) => p.plan === "growth")?.monthly) === 450000);
check("Cameroon Business is 55 000 XAF a month",
  Number(cm.find((p) => p.plan === "business")?.monthly) === 55000);
check("nothing is on quote in a listed country",
  prices.every((p) => p.monthly !== null && p.annual !== null), "three numbers each");

// A Starter agency, built to hit the ceiling.
const [userC] = await q(`insert into auth.users (email) values ('fatou@petite.gn') returning id`);
const [c1] = await asUser(userC.id, `
  select public.create_agency_for_current_user('Petite Agence','Guinea','Conakry','GNF','fr','Fatou Camara','starter') as id`);
const [subC] = await asUser(userC.id, `select plan, status from subscriptions where agency_id = '${c1.id}'`);
check("signup can start the trial on the tier chosen on the pricing page",
  subC?.plan === "starter" && subC?.status === "trialing", `${subC?.plan} / ${subC?.status}`);

const [bFatou] = await asUser(userC.id, `
  insert into buildings (agency_id, name, city) values ('${c1.id}', 'Immeuble Fatou', 'Ratoma') returning id`);
let inserted = 0;
let capMessage = "";
try {
  for (let i = 1; i <= 31; i++) {
    await asUser(userC.id, `
      insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
      values ('${c1.id}', '${bFatou.id}', 'Apt ${i}', 2, 1, 60, 900000)`);
    inserted++;
  }
} catch (err) {
  capMessage = err.message;
}
const [aptCount] = await asUser(userC.id, `select count(*)::int as n from apartments where agency_id = '${c1.id}'`);
check("Starter stops the 31st apartment",
  inserted === 30 && /plan limit reached: 30 apartments allowed on the starter plan/.test(capMessage),
  capMessage || `${inserted} inserted without refusal`);
check("and keeps the thirty it allowed", aptCount.n === 30, `${aptCount.n} apartments`);

let unknownPlanRefused = false;
try {
  await asUser(userC.id, `select public.create_agency_for_current_user('X','Guinea','Conakry','GNF','fr','Y','platinum')`);
} catch (err) {
  unknownPlanRefused = /unknown plan/.test(err.message);
}
check("a tier that does not exist is refused at signup", unknownPlanRefused);

// The plan is what they pay for, so the owner cannot move it themselves.
await asUser(userC.id, `update subscriptions set plan = 'business' where agency_id = '${c1.id}'`);
const [afterPromote] = await asUser(userC.id, `select plan from subscriptions where agency_id = '${c1.id}'`);
check("an owner cannot promote their own subscription",
  afterPromote.plan === "starter", `plan is ${afterPromote.plan}`);

// Choosing a plan records the list price for the agency's country.
const [reqM] = await asUser(userC.id, `select * from public.request_plan('${c1.id}', 'growth', 'monthly')`);
check("a request is recorded at the list price",
  reqM.paid_in === "GNF" && Number(reqM.due) === 450000, `${reqM.due} ${reqM.paid_in}`);
const [reqY] = await asUser(userC.id, `select * from public.request_plan('${c1.id}', 'business', 'annual')`);
check("a yearly request is ten months of the tier",
  Number(reqY.due) === 8500000, `${reqY.due} ${reqY.paid_in}`);
const mine = await asUser(userC.id, `select plan, cycle, status from plan_requests where agency_id = '${c1.id}' order by created_at`);
check("the agency can read its own requests, all pending",
  mine.length === 2 && mine.every((r) => r.status === "pending"),
  mine.map((r) => `${r.plan}/${r.cycle}/${r.status}`).join(", "));

const [userD] = await q(`insert into auth.users (email) values ('paul@douala.cm') returning id`);
const [d1] = await asUser(userD.id, `
  select public.create_agency_for_current_user('Douala Immo','Cameroon','Douala','XAF','fr','Paul Ngassa','growth') as id`);
const [reqD] = await asUser(userD.id, `select * from public.request_plan('${d1.id}', 'business', 'monthly')`);
check("Cameroon is priced from its own list, in XAF",
  reqD.paid_in === "XAF" && Number(reqD.due) === 55000, `${reqD.due} ${reqD.paid_in}`);
let goneTier = false;
try { await asUser(userD.id, `select * from public.request_plan('${d1.id}', 'enterprise', 'monthly')`); }
catch (err) { goneTier = /unknown plan/.test(err.message); }
check("a tier the sheet does not have cannot be requested", goneTier, "enterprise is gone");

const [userE] = await q(`insert into auth.users (email) values ('aicha@bamako.ml') returning id`);
const [e1] = await asUser(userE.id, `
  select public.create_agency_for_current_user('Bamako Immo','Mali','Bamako','XOF','fr','Aïcha Traoré','starter') as id`);
const [reqX] = await asUser(userE.id, `select * from public.request_plan('${e1.id}', 'growth', 'monthly')`);
check("a country without a list gets a quote in its own currency",
  reqX.due === null && reqX.paid_in === "XOF", `${reqX.due} ${reqX.paid_in}`);

await q(`insert into memberships (user_id, agency_id, role, full_name) values ('${manager.id}', '${c1.id}', 'manager', 'Karim')`);
let managerBlocked = false;
try {
  await asUser(manager.id, `select * from public.request_plan('${c1.id}', 'growth', 'monthly')`);
} catch (err) {
  managerBlocked = /only the owner/.test(err.message);
}
check("a manager cannot choose the plan", managerBlocked);

let cycleRefused = false;
try {
  await asUser(userC.id, `select * from public.request_plan('${c1.id}', 'growth', 'weekly')`);
} catch (err) {
  cycleRefused = /unknown billing cycle/.test(err.message);
}
check("a cycle that does not exist is refused", cycleRefused);

const [leak] = await asUser(userB.id, `select count(*)::int as n from plan_requests where agency_id = '${c1.id}'`);
check("requests are invisible outside the agency", leak.n === 0, `${leak.n} rows leaked`);

/* ------------------------------------------------------ the platform desk --
 * Somebody at Charta Home sees every agency and turns a receipt into a plan
 * by issuing a code. The code is bound to one agency, lasts an hour, and
 * dies on use; only that agency's owner can redeem it.
 */
let deskRefused = false;
try { await asUser(userA.id, `select * from public.admin_list_agencies()`); }
catch (err) { deskRefused = /not a platform admin/.test(err.message); }
check("an agency owner is not the platform desk", deskRefused);
let issueRefused = false;
try { await asUser(userA.id, `select * from public.admin_issue_plan_code('${c1.id}', 'growth', 'monthly')`); }
catch (err) { issueRefused = /not a platform admin/.test(err.message); }
check("and cannot issue codes", issueRefused);

const [desk] = await q(`insert into auth.users (email) values ('desk@chartahome.com') returning id`);
await q(`insert into platform_admins (user_id) values ('${desk.id}')`);
const board = await asUser(desk.id, `select * from public.admin_list_agencies()`);
check("the desk sees every agency", board.length >= 5, `${board.length} agencies`);
const rowC = board.find((r) => r.agency_id === c1.id);
check("with its plan, its count against the ceiling, and its ask",
  rowC?.current_plan === "starter" && rowC?.apartments_used === 30 && rowC?.apartments_max === 30 && rowC?.pending_plan === "business",
  `${rowC?.current_plan} ${rowC?.apartments_used}/${rowC?.apartments_max}, asks ${rowC?.pending_plan}`);
const rowA = board.find((r) => r.agency_id === a1.id);
check("and what it has collected, and who owns it",
  Number(rowA?.collected_total) > 0 && rowA?.owner_name === "Amina Sow",
  `${rowA?.collected_total} ${rowA?.agency_currency}, owner ${rowA?.owner_name}`);
const [direct] = await asUser(userC.id, `select count(*)::int as n from plan_codes`);
check("nobody reads codes off the table", direct.n === 0);

const [issued] = await asUser(desk.id, `select * from public.admin_issue_plan_code('${c1.id}', 'business', 'annual')`);
check("a code is eight characters that can be read out over the phone",
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(issued.issued_code), issued.issued_code);
const [ttl] = await q(`select extract(epoch from (expires_at - now())) / 60 as minutes from plan_codes where code = '${issued.issued_code}'`);
check("and lives for an hour", Number(ttl.minutes) > 59 && Number(ttl.minutes) <= 60, `${Number(ttl.minutes).toFixed(1)} min`);
const [seen] = await asUser(desk.id, `select open_code from public.admin_list_agencies() where agency_id = '${c1.id}'`);
check("the desk sees the open code against the agency", seen?.open_code === issued.issued_code);

let managerRedeem = false;
try { await asUser(manager.id, `select * from public.redeem_plan_code('${issued.issued_code}')`); }
catch (err) { managerRedeem = /only the owner/.test(err.message); }
check("a manager of the agency cannot redeem its code", managerRedeem);
let strangerRedeem = false;
try { await asUser(userB.id, `select * from public.redeem_plan_code('${issued.issued_code}')`); }
catch (err) { strangerRedeem = /only the owner/.test(err.message); }
check("nor can the owner of another agency", strangerRedeem);
let unknownRedeem = false;
try { await asUser(userC.id, `select * from public.redeem_plan_code('ZZZZZZZZ')`); }
catch (err) { unknownRedeem = /not found/.test(err.message); }
check("a code that was never issued is refused", unknownRedeem);

// Typed as people type: lower case, with a space either side.
const [used] = await asUser(userC.id, `select * from public.redeem_plan_code(' ${issued.issued_code.toLowerCase()} ')`);
const [subAfter] = await asUser(userC.id, `select plan, status from subscriptions where agency_id = '${c1.id}'`);
check("the owner redeems it and the plan goes live",
  used.new_plan === "business" && subAfter.plan === "business" && subAfter.status === "active",
  `${subAfter.plan} / ${subAfter.status}`);
const [yearOut] = await q(`select (current_period_end - now()) > interval '364 days' as ok from subscriptions where agency_id = '${c1.id}'`);
check("a yearly code runs a year", yearOut.ok === true);
const [desk_settled] = await q(`select status from plan_requests where id = '${reqY.request_id}'`);
check("the request it settles is marked paid", desk_settled.status === "paid", desk_settled.status);
let twice = false;
try { await asUser(userC.id, `select * from public.redeem_plan_code('${issued.issued_code}')`); }
catch (err) { twice = /already used/.test(err.message); }
check("the code dies the moment it is used", twice);

const [old] = await asUser(desk.id, `select * from public.admin_issue_plan_code('${c1.id}', 'growth', 'monthly')`);
await q(`update plan_codes set expires_at = now() - interval '1 minute' where code = '${old.issued_code}'`);
let stale = false;
try { await asUser(userC.id, `select * from public.redeem_plan_code('${old.issued_code}')`); }
catch (err) { stale = /expired/.test(err.message); }
check("an hour on, the code is refused", stale);

const [desk_first] = await asUser(desk.id, `select * from public.admin_issue_plan_code('${c1.id}', 'growth', 'monthly')`);
const [desk_second] = await asUser(desk.id, `select * from public.admin_issue_plan_code('${c1.id}', 'growth', 'monthly')`);
let superseded = false;
try { await asUser(userC.id, `select * from public.redeem_plan_code('${desk_first.issued_code}')`); }
catch (err) { superseded = /expired/.test(err.message); }
check("issuing again retires the code before it", superseded);
const [before] = await q(`select current_period_end from subscriptions where agency_id = '${c1.id}'`);
await asUser(userC.id, `select * from public.redeem_plan_code('${desk_second.issued_code}')`);
const [desk_after] = await q(`select current_period_end, plan from subscriptions where agency_id = '${c1.id}'`);
const added = (new Date(desk_after.current_period_end) - new Date(before.current_period_end)) / 86400000;
check("a renewal runs on from the current period rather than from today",
  desk_after.plan === "growth" && added > 27 && added < 32, `${Math.round(added)} days added to a period that had not ended`);

/* ------------------------------------------------------ every subscription */
let every_subsRefused = false;
try { await asUser(userA.id, `select * from public.admin_list_subscriptions()`); }
catch (err) { every_subsRefused = /not a platform admin/.test(err.message); }
check("the subscription list is the desk's alone", every_subsRefused);
const every_subs = await asUser(desk.id, `select * from public.admin_list_subscriptions()`);
check("the desk sees one row per subscription", every_subs.length >= 5 && new Set(every_subs.map((r) => r.agency_id)).size === every_subs.length, `${every_subs.length} rows`);
const every_subC = every_subs.find((r) => r.agency_id === c1.id);
check("with the price where the agency is, and every activation",
  every_subC?.current_plan === "growth" && every_subC?.plan_status === "active" && Number(every_subC?.monthly_price) === 450000 && Number(every_subC?.annual_price) === 4500000 && every_subC?.activations === 2 && every_subC?.last_activation_plan === "growth" && every_subC?.last_activation_cycle === "monthly",
  `${every_subC?.current_plan}/${every_subC?.plan_status} ${every_subC?.monthly_price} GNF, ${every_subC?.activations} activations, last ${every_subC?.last_activation_plan} ${every_subC?.last_activation_cycle}`);
const every_subB = every_subs.find((r) => r.agency_id === a2.id);
check("a trial shows the price it would pay, and no activations yet",
  every_subB?.plan_status === "trialing" && Number(every_subB?.monthly_price) === 450000 && every_subB?.activations === 0 && every_subB?.last_activation_at === null,
  `${every_subB?.agency_country} ${every_subB?.current_plan}: ${every_subB?.monthly_price}, ${every_subB?.activations} activations`);

/* ------------------------------------------------------- one agency, in full */
let detailRefused = false;
try { await asUser(userC.id, `select public.admin_agency_detail('${c1.id}')`); }
catch (err) { detailRefused = /not a platform admin/.test(err.message); }
check("an agency cannot read its own desk file", detailRefused);
const [{ admin_agency_detail: file }] = await asUser(desk.id, `select public.admin_agency_detail('${c1.id}')`);
check("the desk reads the agency in one document",
  file?.agency?.id === c1.id && file.subscription?.plan === "growth" && file.subscription?.status === "active",
  `${file?.agency?.name}: ${file?.subscription?.plan}/${file?.subscription?.status}`);
check("with its people and its buildings",
  Array.isArray(file.members) && file.members.some((m) => m.role === "owner") && file.members.some((m) => m.role === "manager") && file.buildings.length >= 1 && file.money.apartments === 30,
  `${file.members.length} members, ${file.buildings.length} buildings, ${file.money.apartments} apartments`);
check("every code ever issued, with its state",
  file.codes.length >= 4 && file.codes.filter((c) => c.state === "used").length === 2 && file.codes.filter((c) => c.state === "expired").length >= 2 && file.codes.every((c) => /^[A-Z2-9]{8}$/.test(c.code)),
  file.codes.map((c) => `${c.plan}/${c.cycle}:${c.state}`).join(", "));
check("every request, with what became of it",
  file.requests.length >= 1 && file.requests.some((r) => r.status === "paid") && file.requests.every((r) => r.plan && r.cycle),
  file.requests.map((r) => `${r.plan}/${r.cycle}:${r.status}`).join(", "));
let unknownAgency = false;
try { await asUser(desk.id, `select public.admin_agency_detail('00000000-0000-0000-0000-000000000000')`); }
catch (err) { unknownAgency = /unknown agency/.test(err.message); }
check("an agency that does not exist is an error, not an empty page", unknownAgency);

/* ------------------------------------------------------ a tenant's email */
const [aptE] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Apt Mail', 2, 1, 60, 900000) returning id`);
const [leaseE] = await asUser(userA.id, `
  select public.create_lease('${aptE.id}', 'Fatou Camara', '+224620998877', 900000, 'monthly', date '2026-09-01', 0, null, ' Fatou.Camara@Example.com ') as id`);
const [resE] = await asUser(userA.id, `select r.email::text as email from residents r join leases l on l.resident_id = r.id where l.id = '${leaseE.id}'`);
check("a tenant's email is stored, trimmed and lower cased", resE?.email === "fatou.camara@example.com", String(resE?.email));
const [stateE] = await asUser(userA.id, `select resident_email from v_apartment_state where apartment_id = '${aptE.id}'`);
check("the dashboard's view carries it", stateE?.resident_email === "fatou.camara@example.com");
const [targetE] = await asUser(userA.id, `select resident_email, agency_locale from v_reminder_targets where rent_charge_id = (select id from rent_charges where lease_id = '${leaseE.id}' limit 1)`);
check("and so does the reminder job's, with the agency's language",
  targetE?.resident_email === "fatou.camara@example.com" && targetE?.agency_locale === "fr", `${targetE?.resident_email} / ${targetE?.agency_locale}`);
let badEmail = false;
try { await asUser(userA.id, `select public.create_lease('${aptE.id}', 'X', null, 1, 'monthly', current_date, 0, null, 'not an address')`); }
catch (err) { badEmail = /residents_email_shape/.test(err.message); }
check("an address that is not an address is refused", badEmail);
const [aptE2] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Apt Mail 2', 2, 1, 60, 900000) returning id`);
await asUser(userA.id, `select public.create_lease('${aptE2.id}', 'Fatou Camara', '+224620998877', 900000, 'monthly', date '2026-09-01', 0, null, null)`);
const [kept] = await asUser(userA.id, `select email::text as email from residents where phone_e164 = '+224620998877'`);
check("a second lease with no address does not erase the one on file", kept?.email === "fatou.camara@example.com", String(kept?.email));

/* -------------------------------------------------- what a flat has been */
const [hist] = await asUser(userA.id, `select tenants_ever, collected_lifetime, payments_count, first_lease_on, tickets_total, tickets_open from v_apartment_performance where apartment_id = '${apt.id}'`);
check("the unit knows how many tenants it has had",
  hist?.tenants_ever >= 1 && (() => { const d = new Date(hist.first_lease_on); return d.getFullYear() === 2026 && d.getMonth() === 7 && d.getDate() === 1; })(),
  `${hist?.tenants_ever} tenants, first lease ${hist?.first_lease_on}`);
check("and what it has taken over its life",
  Number(hist?.collected_lifetime) > 0 && hist?.payments_count >= 1, `${hist?.collected_lifetime} over ${hist?.payments_count} payments`);
check("and its tickets", typeof hist?.tickets_total === "number" && hist.tickets_open <= hist.tickets_total, `${hist?.tickets_open} open of ${hist?.tickets_total}`);
const [never] = await asUser(userA.id, `select tenants_ever, first_lease_on from v_apartment_performance where apartment_id = '${aptE2.id}'`);
check("a flat let once reads as one tenant, not as never let", never?.tenants_ever === 1 && never?.first_lease_on !== null);

/* ---------------------------------------------------- paying online */
// Douala Immo is on Cameroon's list, so it can open a checkout.
let strangerBegin = false;
try { await asUser(userA.id, `select * from public.begin_subscription_payment('${d1.id}', 'growth', 'monthly', 'CHAAAA0001')`); }
catch (err) { strangerBegin = /only the owner/.test(err.message); }
check("only the owner can open a payment for their agency", strangerBegin);
let badRef = false;
try { await asUser(userD.id, `select * from public.begin_subscription_payment('${d1.id}', 'growth', 'monthly', 'CH-with-dash')`); }
catch (err) { badRef = /letters and digits/.test(err.message); }
check("a transaction id Orange Money would refuse is refused first", badRef);
let noList = false;
try { await asUser(userE.id, `select * from public.begin_subscription_payment('${e1.id}', 'growth', 'monthly', 'CHAAAA0002')`); }
catch (err) { noList = /no list price/.test(err.message); }
check("a country without a list cannot pay online; a quote is a conversation", noList);

const [opened] = await asUser(userD.id, `select * from public.begin_subscription_payment('${d1.id}', 'growth', 'annual', 'CHAAAA0003')`);
check("opening a payment records the list price where the agency is",
  opened?.paid_in === "XAF" && Number(opened?.due) === 300000 && Boolean(opened?.request_id), `${opened?.due} ${opened?.paid_in}`);
const [mineRow] = await asUser(userD.id, `select status, provider_ref from subscription_payments where id = '${opened.payment_id}'`);
check("the agency can read its own payment row", mineRow?.status === "initiated" && mineRow?.provider_ref === "CHAAAA0003");
const notMine = await asUser(userA.id, `select id from subscription_payments where id = '${opened.payment_id}'`);
check("and nobody else can", notMine.length === 0);

let ownerSettles = false;
try { await asUser(userD.id, `select * from public.settle_subscription_payment('${opened.payment_id}', 'paid')`); }
catch (err) { ownerSettles = /permission denied/.test(err.message); }
check("an owner cannot settle their own payment; only the server can", ownerSettles);

const [pay_before] = await q(`select current_period_end, status, plan from subscriptions where agency_id = '${d1.id}'`);
const [pay_settled] = await q(`select * from public.settle_subscription_payment('${opened.payment_id}', 'paid', '{"transaction_status":"SUCCESS"}'::jsonb)`);
const [pay_after] = await q(`select current_period_end, status, plan from subscriptions where agency_id = '${d1.id}'`);
check("a paid settlement activates the plan for a year",
  pay_settled?.outcome === "paid" && pay_after.status === "active" && pay_after.plan === "growth" &&
    (new Date(pay_after.current_period_end) - Date.now()) > 364 * 86400000,
  `${pay_before.status}/${pay_before.plan} → ${pay_after.status}/${pay_after.plan}`);
const [reqRow] = await q(`select status from plan_requests where id = '${opened.request_id}'`);
check("and marks the request it opened as paid", reqRow?.status === "paid");
const [again] = await q(`select * from public.settle_subscription_payment('${opened.payment_id}', 'paid')`);
const [afterAgain] = await q(`select current_period_end from subscriptions where agency_id = '${d1.id}'`);
check("settling twice, as a callback and a return page will, extends the period once",
  again?.outcome === "paid" && String(afterAgain.current_period_end) === String(pay_after.current_period_end));

const [opened2] = await asUser(userD.id, `select * from public.begin_subscription_payment('${d1.id}', 'business', 'monthly', 'CHAAAA0004')`);
const [failedRow] = await q(`select * from public.settle_subscription_payment('${opened2.payment_id}', 'failed')`);
const [afterFail] = await q(`select plan, current_period_end from subscriptions where agency_id = '${d1.id}'`);
const [closedReq] = await q(`select status from plan_requests where id = '${opened2.request_id}'`);
check("a failed checkout closes the request it opened, so the desk is not waiting for a code",
  closedReq?.status === "cancelled", String(closedReq?.status));
check("a failed payment changes nothing about the plan",
  failedRow?.outcome === "failed" && afterFail.plan === "growth" && String(afterFail.current_period_end) === String(pay_after.current_period_end));
let badFinal = false;
try { await q(`select * from public.settle_subscription_payment('${opened2.payment_id}', 'maybe')`); }
catch (err) { badFinal = /unknown final status/.test(err.message); }
check("a settlement must be paid, failed or cancelled", badFinal);
const [{ admin_agency_detail: fileD }] = await asUser(desk.id, `select public.admin_agency_detail('${d1.id}')`);
check("the desk sees online payments on the agency's file",
  Array.isArray(fileD.online_payments) && fileD.online_payments.length === 2 &&
    fileD.online_payments.some((p) => p.status === "paid" && p.provider_ref === "CHAAAA0003"),
  fileD.online_payments?.map((p) => `${p.plan}/${p.cycle}:${p.status}`).join(", "));

/* ------------------------------------------------------ letting by night */
// A unit of Amina's, offered by the night.
const [aptN] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Studio Nuit', 1, 1, 32, 0) returning id`);
await asUser(userA.id, `
  insert into stay_rates (agency_id, apartment_id, nights, price) values
    ('${a1.id}', '${aptN.id}', 1, 350000),
    ('${a1.id}', '${aptN.id}', 3, 900000),
    ('${a1.id}', '${aptN.id}', 7, 1900000)`);
const ratesSeen = await asUser(userA.id, `select nights, price from stay_rates where apartment_id = '${aptN.id}' order by nights`);
check("an agency sets its own durations and prices",
  ratesSeen.length === 3 && Number(ratesSeen[1].price) === 900000,
  ratesSeen.map((r) => `${r.nights}n=${r.price}`).join(" "));
let twoSameNights = false;
try { await asUser(userA.id, `insert into stay_rates (agency_id, apartment_id, nights, price) values ('${a1.id}', '${aptN.id}', 3, 800000)`); }
catch (err) { twoSameNights = /duplicate key|unique/i.test(err.message); }
check("one price per duration, so the list can answer its own question", twoSameNights);

const [stayA] = await asUser(userA.id, `
  select public.create_stay('${aptN.id}', 'Awa Baldé', date '2026-11-10', date '2026-11-13', 900000, '+224620111222', 'awa@example.com', 400000) as id`);
const [stayRow] = await asUser(userA.id, `select guest_name, guest_email::text as email, amount, paid, paid_on, status, (check_out - check_in) as nights from stays where id = '${stayA.id}'`);
check("a stay records the guest, the nights and what was agreed",
  stayRow?.nights === 3 && Number(stayRow.amount) === 900000 && Number(stayRow.paid) === 400000 && stayRow.status === "booked" && stayRow.email === "awa@example.com",
  `${stayRow?.nights} nights, ${stayRow?.paid} of ${stayRow?.amount}`);
check("and taking a booking marks the unit as let by the night",
  (await asUser(userA.id, `select short_stay from apartments where id = '${aptN.id}'`))[0]?.short_stay === true);

// The whole point: one flat, one guest at a time.
let clash = "";
try { await asUser(userA.id, `select public.create_stay('${aptN.id}', 'Ibrahim Sow', date '2026-11-12', date '2026-11-15', 900000)`); }
catch (err) { clash = err.message; }
check("a second guest cannot be booked over the first",
  /is taken from 10\/11\/2026 to 13\/11\/2026 by Awa Baldé/.test(clash), clash || "no refusal");
let inside = false;
try { await asUser(userA.id, `select public.create_stay('${aptN.id}', 'X', date '2026-11-11', date '2026-11-12', 1)`); }
catch (err) { inside = /is taken from/.test(err.message); }
check("nor inside the first", inside);
let wraps = false;
try { await asUser(userA.id, `select public.create_stay('${aptN.id}', 'X', date '2026-11-09', date '2026-11-20', 1)`); }
catch (err) { wraps = /is taken from/.test(err.message); }
check("nor around it", wraps);

// Half open dates: the guest leaving on the 13th frees the night of the 13th.
const [sameDay] = await asUser(userA.id, `
  select public.create_stay('${aptN.id}', 'Kadiatou Barry', date '2026-11-13', date '2026-11-14', 350000) as id`);
check("the night of check out is free for the next guest", Boolean(sameDay?.id),
  "13 to 14 follows 10 to 13 with no gap");

let backwards = false;
try { await asUser(userA.id, `select public.create_stay('${aptN.id}', 'X', date '2026-12-05', date '2026-12-05', 1)`); }
catch (err) { backwards = /must end after it begins/.test(err.message); }
check("a stay of no nights is refused", backwards);
let overpaid = false;
try { await asUser(userA.id, `select public.create_stay('${aptN.id}', 'X', date '2026-12-05', date '2026-12-07', 100, null, null, 500)`); }
catch (err) { overpaid = /cannot exceed/.test(err.message); }
check("more received than agreed is refused", overpaid);
let outsiderBooks = false;
try { await asUser(userB.id, `select public.create_stay('${aptN.id}', 'X', date '2027-01-05', date '2027-01-07', 100)`); }
catch (err) { outsiderBooks = /not allowed to book/.test(err.message); }
check("somebody outside the agency cannot book its units", outsiderBooks);
// A manager runs the portfolio, so a manager takes bookings. Booked and then
// cancelled, so the counts below are about the guests, not about this check.
const [byManager] = await asUser(manager.id, `
  select public.create_stay('${aptN.id}', 'Booked by Karim', date '2027-01-05', date '2027-01-07', 100) as id`);
check("a manager of the agency can", Boolean(byManager?.id));
await asUser(manager.id, `select public.update_stay('${byManager.id}', null, null, 'cancelled')`);
const strangerSees = await asUser(userB.id, `select id from stays where apartment_id = '${aptN.id}'`);
check("and cannot read its bookings either", strangerSees.length === 0);

// A cancelled stay holds no dates.
await asUser(userA.id, `select public.update_stay('${sameDay.id}', null, null, 'cancelled')`);
const [reused] = await asUser(userA.id, `
  select public.create_stay('${aptN.id}', 'Mamadou Diallo', date '2026-11-13', date '2026-11-16', 900000) as id`);
check("a cancelled booking frees its dates", Boolean(reused?.id));

// Money: what a guest paid counts for the unit and the building, dated by
// when it arrived rather than by when the stay is.
await asUser(userA.id, `select public.update_stay('${stayA.id}', 900000, current_date, 'checked_out')`);
const [perfN] = await asUser(userA.id, `select collected_ytd, collected_lifetime, nights_let, guests_ever, nights_let_ytd from v_apartment_performance where apartment_id = '${aptN.id}'`);
check("what a guest paid is the unit's income",
  Number(perfN?.collected_ytd) === 900000 && Number(perfN?.collected_lifetime) === 900000,
  `${perfN?.collected_ytd} this year`);
check("and the unit counts its nights and its guests",
  perfN?.nights_let === 6 && perfN?.guests_ever === 2 && perfN?.nights_let_ytd === 3,
  `${perfN?.nights_let} nights over ${perfN?.guests_ever} stays, ${perfN?.nights_let_ytd} paid this year`);
const [perfB] = await asUser(userA.id, `select income_ytd from v_building_performance where building_id = '${bA.id}'`);
check("the building's year includes what the night lets took",
  Number(perfB?.income_ytd) >= 900000, `${perfB?.income_ytd}`);

// A booking in the future is money promised, not money collected.
const [future] = await asUser(userA.id, `
  select public.create_stay('${aptN.id}', 'Sira Keita', date '2027-03-01', date '2027-03-08', 1900000) as id`);
const [perfAfter] = await asUser(userA.id, `select collected_ytd from v_apartment_performance where apartment_id = '${aptN.id}'`);
check("a booking nobody has paid for yet is not income",
  Number(perfAfter?.collected_ytd) === 900000, `still ${perfAfter?.collected_ytd}`);

// The unit's state knows who is in it and who is next.
await asUser(userA.id, `select public.create_stay('${aptN.id}', 'Guest Today', current_date - 1, current_date + 2, 350000)`);
const [stateN] = await asUser(userA.id, `select short_stay, stay_guest, next_stay_guest, is_occupied from v_apartment_state where apartment_id = '${aptN.id}'`);
check("the unit shows the guest in it and the one after",
  stateN?.stay_guest === "Guest Today" && stateN?.next_stay_guest === "Awa Baldé" && stateN?.short_stay === true,
  `${stateN?.stay_guest} now, then the earliest booking after today: ${stateN?.next_stay_guest}`);
check("and a short stay is not a tenancy, so vacancy for long lets is unmoved",
  stateN?.is_occupied === false, "no lease on this unit");
void future;

/* ------------------------------------- every unit is on the app, by date */
// aptN is let by the night and holds no lease: free now.
const [aptLet] = await asUser(userA.id, `
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values ('${a1.id}', '${bA.id}', 'Apt Occupe', 2, 1, 50, 900000) returning id`);
await asUser(userA.id, `
  select public.create_lease('${aptLet.id}', 'ZZ Occupant', '+224620777888', 900000, 'monthly',
                             current_date, 0, current_date + 60)`);
await q(`update apartments set short_stay = true where id = '${aptLet.id}'`);
await q(`insert into stay_rates (agency_id, apartment_id, nights, price)
         values ('${a1.id}', '${aptLet.id}', 1, 200000) on conflict do nothing`);

// The flag an agency used to have to switch on decides nothing now.
await q(`update apartments set listed = false where id = '${aptN.id}'`);
const taken = await asUser(userA.id, `select * from public.listing_taken_nights(array['${aptN.id}']::uuid[])`);
check("a unit nobody published still shows its calendar",
  Array.isArray(taken), `${taken.length} booked ranges`);

// Booking by the night is a date question, not a flag question.
const [guest] = await q(`insert into auth.users (email) values ('guest@app.test') returning id`);
let duringLease = "";
try {
  await asUser(guest.id, `select public.book_stay('${aptLet.id}', current_date + 5, current_date + 7)`);
} catch (err) { duringLease = err.message; }
check("a unit with a tenant in it cannot be booked for those nights",
  /is let on these dates/.test(duringLease), duringLease || "no refusal");

const afterLease = await asUser(guest.id,
  `select public.book_stay('${aptLet.id}', current_date + 70, current_date + 72) as r`);
check("and can be booked for after the tenancy ends",
  Boolean(afterLease[0]?.r), "the unit comes free and the app can sell it");

await db.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
