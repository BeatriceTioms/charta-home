/**
 * Checks the resident-app migration against every other migration, in an
 * in-process Postgres (PGlite), then exercises it: package prices, holds and
 * clashes, claiming a resident profile, tickets and payment settlement.
 *
 * Copy to the web project's scripts/ and run: node scripts/verify-resident-app.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "supabase", "migrations");
const MINE_FILE = "20260808123000_resident_app.sql";
const SAAS = DIR;
const MINE = path.join(DIR, MINE_FILE);

const db = new PGlite({ extensions: { citext, pgcrypto } });
await db.exec(`create extension if not exists pgcrypto; create extension if not exists citext;`);
await db.exec(`
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create schema if not exists auth; create schema if not exists storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb not null default '{}');
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
`);
const all = (await readdir(SAAS)).filter((f) => f.endsWith(".sql")).sort();
for (const f of all.filter((f) => f < MINE_FILE)) {
  try { await db.exec(await readFile(`${SAAS}/${f}`, "utf8")); } catch (e) { console.error("SAAS FAIL", f, e.message); process.exit(1); }
}
await db.exec(await readFile(MINE, "utf8"));
// Later migrations build on this one (account deletion).
for (const f of all.filter((f) => f > MINE_FILE)) {
  try { await db.exec(await readFile(`${SAAS}/${f}`, "utf8")); } catch (e) { console.error("LATER FAIL", f, e.message); process.exit(1); }
}
console.log("migration applied");

const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const ok = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1); } console.log("ok -", msg); };
const as = (uid) => db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false)`);

const ag = await one(`insert into agencies (name, country, city, currency) values ('Charta Immobilier','Cameroon','Yaoundé','XAF') returning id`);
const b = await one(`insert into buildings (agency_id, name, city) values ($1,'Les Palmiers','Yaoundé') returning id`, [ag.id]);
const ap = await one(`insert into apartments (agency_id, building_id, label, base_rent, short_stay, listed) values ($1,$2,'B2',350000,true,true) returning id`, [ag.id, b.id]);
for (const [n, price] of [[1, 35000], [3, 99000], [7, 220000]])
  await db.query(`insert into stay_rates (agency_id, apartment_id, nights, price) values ($1,$2,$3,$4)`, [ag.id, ap.id, n, price]);

const q = async (n) => Number((await one(`select public.stay_quote($1,$2) v`, [ap.id, n])).v);
ok(await q(1) === 35000, "1 night = package price");
ok(await q(2) === 70000, "2 nights = 2 × nightly");
ok(await q(3) === 99000, "3 nights = 3-night package");
ok(await q(10) === Math.round(220000 / 7 * 10), "10 nights use the 7-night per-night price");

const u = await one(`insert into auth.users (email, raw_user_meta_data) values ('ada@mail.cm', '{"full_name":"Ada N","phone":"+237677000000"}') returning id`);
const u2 = await one(`insert into auth.users (email) values ('bob@mail.cm') returning id`);
await as(u.id);
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const r = await one(`select public.book_stay($1, $2::date, $3::date) j`, [ap.id, inDays(2), inDays(5)]);
ok(Number(r.j.amount) === 99000 && r.j.stay_id, "book_stay holds 3 nights at the package price");
await as(u2.id);
let clash = null;
try { await db.query(`select public.book_stay($1, $2::date, $3::date)`, [ap.id, inDays(4), inDays(6)]); } catch (e) { clash = e; }
ok(clash && clash.code === "23P01" && clash.detail === inDays(4), "overlapping booking refused, detail = first taken night");
const taken = await db.query(`select * from public.listing_taken_nights(array[$1]::uuid[])`, [ap.id]);
ok(taken.rows.length === 1, "taken nights visible without guest details");
await db.exec(`update stays set hold_expires_at = now() - interval '1 minute'`);
const r2 = await one(`select public.book_stay($1, $2::date, $3::date) j`, [ap.id, inDays(4), inDays(6)]);
ok(r2.j.stay_id, "a lapsed unpaid hold frees its nights");

// resident flow
await as(null);
const res = await one(`insert into residents (agency_id, full_name, phone_e164, email) values ($1,'Ada N','+237677000000','ADA@mail.cm') returning id`, [ag.id]);
const lease = await one(`insert into leases (agency_id, apartment_id, resident_id, rent_amount, due_day, starts_on) values ($1,$2,$3,350000,5,current_date - 60) returning id`, [ag.id, ap.id, res.id]);
const ch = await one(`insert into rent_charges (agency_id, lease_id, period_start, period_end, amount, due_on) values ($1,$2,date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month - 1 day')::date,350000,current_date) returning id`, [ag.id, lease.id]);
await as(u.id);
ok(Number((await one(`select public.claim_resident_profile() n`)).n) === 1, "sign-up claims the agency's resident row by email");
const t = await one(`select public.resident_create_ticket('Leak','Sink drips','plumbing','high','Kitchen', array[$1 || '/a.jpg','someone-else/b.jpg']) j`, [u.id]);
ok(t.j.number, "resident opens a ticket on their home");
const tk = await one(`select photo_paths, reported_via::text rv from tickets where id = $1`, [t.j.id]);
ok(tk.photo_paths.length === 1 && tk.rv === "app", "only own photos kept, channel = app");

// settlement (service role)
await as(null);
const next = new Date(); next.setDate(1); next.setMonth(next.getMonth() + 1);
const adv = next.toISOString().slice(0, 10);
await db.query(`insert into resident_payments (agency_id, user_id, kind, lease_id, charge_ids, advance_periods, amount, currency, method, provider_ref) values ($1,$2,'rent',$3,array[$4]::uuid[],array[$5]::date[],700000,'XAF','mobile_money','CHTEST01')`, [ag.id, u.id, lease.id, ch.id, adv]);
ok((await one(`select public.settle_resident_payment('CHTEST01','paid','{"provider":"Orange Money"}') s`)).s === "paid", "rent payment settles");
ok((await one(`select public.settle_resident_payment('CHTEST01','paid') s`)).s === "paid", "settling twice changes nothing");
const pays = await db.query(`select method::text m from payments where lease_id = $1`, [lease.id]);
ok(pays.rows.length === 1 && pays.rows[0].m === "orange_money", "one payment row, network from PayUnit");
const bal = await db.query(`select balance from v_charge_status where lease_id = $1`, [lease.id]);
ok(bal.rows.length === 2 && bal.rows.every((x) => Number(x.balance) === 0), "current month and month ahead both paid");

await db.query(`insert into resident_payments (agency_id, user_id, kind, stay_id, amount, currency, method, provider_ref) values ($1,$2,'stay',$3,99000,'XAF','card','CSTEST01')`, [ag.id, u.id, r.j.stay_id]);
await db.query(`select public.settle_resident_payment('CSTEST01','paid')`);
const st = await one(`select paid, hold_expires_at from stays where id = $1`, [r.j.stay_id]);
ok(Number(st.paid) === 99000 && st.hold_expires_at === null, "stay paid and hold cleared");

// a unit with a tenant cannot take guests by the night
await as(u2.id);
let letClash = null;
try { await db.query(`select public.book_stay($1, $2::date, $3::date)`, [ap.id, inDays(20), inDays(22)]); } catch (e) { letClash = e; }
ok(letClash?.code === "23P01", "nights inside a tenancy are refused");

// account deletion: u2 holds unpaid nights and owns a photo, then leaves
await as(null);
const apS = await one(`insert into apartments (agency_id, building_id, label, base_rent, short_stay) values ($1,$2,'S1',200000,true) returning id`, [ag.id, b.id]);
await db.query(`insert into stay_rates (agency_id, apartment_id, nights, price) values ($1,$2,1,30000)`, [ag.id, apS.id]);
await as(u2.id);
const h = await one(`select public.book_stay($1, $2::date, $3::date) j`, [apS.id, inDays(20), inDays(22)]);
await as(null);
await db.query(`insert into storage.objects (bucket_id, name, owner) values ('ticket-photos', $1::text || '/c.jpg', $1::uuid)`, [u2.id]);
await db.query(`select public.forget_resident_user($1)`, [u2.id]);
ok((await one(`select status from stays where id = $1`, [h.j.stay_id])).status === "cancelled", "deleting an account frees its unpaid hold");
ok(Number((await one(`select count(*) n from storage.objects where owner = $1`, [u2.id])).n) === 0, "photos no longer owned by the leaving user");
await db.query(`delete from auth.users where id = $1`, [u.id]);
const kept = await one(`select count(*) n, count(user_id) linked from resident_payments`);
ok(Number(kept.n) === 2 && Number(kept.linked) === 0, "payments survive the payer's account, unlinked");
ok(Number((await one(`select paid from stays where id = $1`, [r.j.stay_id])).paid) === 99000, "paid stay kept for the agency");

// open listings and monthly booking
const free = async (id) => (await one(`select public.apartment_free_from($1) d`, [id])).d;
ok((await free(ap.id)) === null, "unit under a lease with no end date has no free day");
const ap2 = await one(`insert into apartments (agency_id, building_id, label, base_rent) values ($1,$2,'C1',200000) returning id`, [ag.id, b.id]);
const ap3 = await one(`insert into apartments (agency_id, building_id, label, base_rent) values ($1,$2,'C2',150000) returning id`, [ag.id, b.id]);
const res3 = await one(`insert into residents (agency_id, full_name) values ($1,'Old tenant') returning id`, [ag.id]);
await db.query(`insert into leases (agency_id, apartment_id, resident_id, rent_amount, starts_on, ends_on) values ($1,$2,$3,150000,current_date - 300, current_date + 30)`, [ag.id, ap3.id, res3.id]);
const day = (d) => new Date(d).toISOString().slice(0, 10);
ok(day(await free(ap2.id)) === inDays(0), "vacant unit is free today");
ok(day(await free(ap3.id)) === inDays(31), "occupied unit is free the day after its lease ends");
const av = await db.query(`select * from public.apartments_availability(array[$1,$2,$3]::uuid[]) order by free_from nulls first`, [ap.id, ap2.id, ap3.id]);
ok(av.rows.length === 3 && av.rows[0].free_from === null && av.rows[0].occupied === true, "availability feed covers every unit");

await as(u2.id);
let refused = false;
try { await db.query(`select public.book_lease($1, $2::date, 12)`, [ap3.id, inDays(10)]); } catch (e) { refused = e.code === "23P01"; }
ok(refused, "booking before the lease ends is refused");
const bk = await one(`select public.book_lease($1, $2::date, 12, 'Bob', '+237600000002') j`, [ap3.id, inDays(31)]);
ok(Number(bk.j.amount) === 450000, "booking costs first month + two-month deposit");
await as(u.id);
let bookClash = false;
try { await db.query(`select public.book_lease($1, $2::date, 6)`, [ap3.id, inDays(40)]); } catch (e) { bookClash = e.code === "23P01"; }
ok(bookClash, "a held booking blocks the same months for others");
await as(null);
await db.query(`insert into resident_payments (agency_id, user_id, kind, lease_request_id, amount, currency, method, provider_ref) values ($1,$2,'booking',$3,450000,'XAF','mobile_money','BKTEST01')`, [ag.id, u2.id, bk.j.request_id]);
ok((await one(`select public.settle_resident_payment('BKTEST01','paid') s`)).s === "paid", "booking payment settles");
const lr = await one(`select status, paid, hold_expires_at, contact_name from lease_requests where id = $1`, [bk.j.request_id]);
ok(lr.status === "reserved" && Number(lr.paid) === 450000 && lr.hold_expires_at === null && lr.contact_name === "Bob", "paid booking becomes a reservation");
ok(day(await free(ap3.id)) > inDays(390), "reserved months are no longer free");

// nights and months never overlap, whichever was booked first
await db.query(`update apartments set short_stay = true where id = $1`, [ap3.id]);
await db.query(`insert into stay_rates (agency_id, apartment_id, nights, price) values ($1,$2,1,20000)`, [ag.id, ap3.id]);
const u3 = await one(`insert into auth.users (email) values ('cleo@mail.cm') returning id`);
await as(u3.id);
let nightClash = null;
try { await db.query(`select public.book_stay($1, $2::date, $3::date)`, [ap3.id, inDays(60), inDays(62)]); } catch (e) { nightClash = e; }
ok(nightClash?.code === "23P01", "reserved months cannot be booked by the night");
await one(`select public.book_stay($1, $2::date, $3::date) j`, [apS.id, inDays(5), inDays(7)]);
let monthClash = null;
try { await db.query(`select public.book_lease($1, $2::date, 6)`, [apS.id, inDays(1)]); } catch (e) { monthClash = e; }
ok(monthClash?.code === "23P01" && monthClash.detail === inDays(7), "guests' nights block a lease until they leave");
ok(Boolean((await one(`select public.book_lease($1, $2::date, 6) j`, [apS.id, inDays(7)])).j.request_id), "the lease can start the day the guests leave");
console.log("\nALL CHECKS PASSED");
