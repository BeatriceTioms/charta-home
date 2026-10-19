-- Charta Home · resident app (the Flutter app in Charta Home mobile)
--
-- Copy this file into the web project's supabase/migrations and push it with
-- the rest (`npm run db:bundle` / `supabase db push`). It only adds: nothing
-- an agency already does in the dashboard changes.
--
-- Until now every row was readable only by the agency's own members. A
-- resident who signs in to the app is not a member. This migration lets a
-- resident see exactly their own lease, rent, payments, repairs and stays,
-- lets anyone browse listings an agency chose to publish, and gives the app a
-- handful of functions for the few things it writes. Money is never written
-- by the app: payments are settled by the web app (service role) after it
-- has asked PayUnit, exactly like subscription payments.

-- ---------------------------------------------------------------------------
-- 1. Linking a signed-in user to the agency's resident record
-- ---------------------------------------------------------------------------

-- Stays booked from the app belong to a user and hold their dates for a few
-- minutes until paid (used by listing_taken_nights and book_stay below).
alter table stays add column if not exists guest_user_id uuid references auth.users (id) on delete set null;
alter table stays add column if not exists hold_expires_at timestamptz;
alter table stays add column if not exists source text not null default 'desk' check (source in ('desk', 'app'));

alter table residents add column if not exists user_id uuid references auth.users (id) on delete set null;
create unique index if not exists residents_user_agency_uniq on residents (user_id, agency_id) where user_id is not null;

/**
 * The residents rows that belong to the signed-in user (one per agency they
 * rent from). Used by every resident policy below.
 */
create or replace function public.current_resident_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.residents where user_id = auth.uid()
$$;

/**
 * Called by the app right after sign-in or sign-up. Attaches the user to the
 * resident rows the agencies already created for them, matched on the
 * account's email, or on the phone given at sign-up (user metadata). Only
 * rows not yet claimed are touched, so nobody can take over someone else's.
 */
create or replace function public.claim_resident_profile()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  u record;
  phone text;
  n integer;
begin
  select id, email, raw_user_meta_data into u from auth.users where id = auth.uid();
  if not found then
    return 0;
  end if;
  phone := nullif(u.raw_user_meta_data ->> 'phone', '');
  update public.residents r
     set user_id = u.id
   where r.user_id is null
     and ((u.email is not null and lower(r.email::text) = lower(u.email))
          or (phone is not null and r.phone_e164 = phone));
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.current_resident_ids() to authenticated;
grant execute on function public.claim_resident_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. What a resident may read (row level security, read only)
-- ---------------------------------------------------------------------------

drop policy if exists residents_self_read on residents;
create policy residents_self_read on residents for select
  using (user_id = auth.uid());

drop policy if exists leases_resident_read on leases;
create policy leases_resident_read on leases for select
  using (resident_id in (select public.current_resident_ids()));

drop policy if exists rent_charges_resident_read on rent_charges;
create policy rent_charges_resident_read on rent_charges for select
  using (lease_id in (select id from public.leases where resident_id in (select public.current_resident_ids())));

drop policy if exists payments_resident_read on payments;
create policy payments_resident_read on payments for select
  using (lease_id in (select id from public.leases where resident_id in (select public.current_resident_ids())));

drop policy if exists payment_allocations_resident_read on payment_allocations;
create policy payment_allocations_resident_read on payment_allocations for select
  using (payment_id in (
    select p.id from public.payments p
    join public.leases l on l.id = p.lease_id
    where l.resident_id in (select public.current_resident_ids())));

drop policy if exists tickets_resident_read on tickets;
create policy tickets_resident_read on tickets for select
  using (resident_id in (select public.current_resident_ids()));

drop policy if exists ticket_messages_resident_read on ticket_messages;
create policy ticket_messages_resident_read on ticket_messages for select
  using (ticket_id in (select id from public.tickets where resident_id in (select public.current_resident_ids())));

-- ---------------------------------------------------------------------------
-- 3. Listings: what an agency publishes to the app
-- ---------------------------------------------------------------------------

alter table apartments add column if not exists listed boolean not null default false;
alter table apartments add column if not exists listing_title text;
alter table apartments add column if not exists listing_description text;
alter table apartments add column if not exists available_from date;
alter table apartments add column if not exists kind text not null default 'apartment'
  check (kind in ('apartment', 'studio', 'house', 'villa', 'duplex'));
alter table buildings add column if not exists neighborhood text;
alter table buildings add column if not exists latitude numeric(9, 6);
alter table buildings add column if not exists longitude numeric(9, 6);

comment on column apartments.listed is
  'Shown in the resident app. Off by default: an agency publishes a unit on purpose.';

/**
 * Nights already taken at the given units, for the app's calendars. Dates
 * only: no guest name, phone or price ever leaves through here. Cancelled
 * stays and lapsed unpaid holds free their nights.
 */
create or replace function public.listing_taken_nights(apartment_ids uuid[])
returns table (apartment_id uuid, check_in date, check_out date)
language sql
stable
security definer
set search_path = ''
as $$
  select s.apartment_id, s.check_in, s.check_out
  from public.stays s
  join public.apartments a on a.id = s.apartment_id
  where s.apartment_id = any (apartment_ids)
    and a.listed
    and s.status <> 'cancelled'
    and not (s.paid = 0 and s.hold_expires_at is not null and s.hold_expires_at < now())
    and s.check_out > current_date
$$;

grant execute on function public.listing_taken_nights(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Booking a short stay from the app
-- ---------------------------------------------------------------------------

create index if not exists stays_guest_idx on stays (guest_user_id, check_in desc);

drop policy if exists stays_guest_read on stays;
create policy stays_guest_read on stays for select
  using (guest_user_id = auth.uid());

/**
 * The price of a stay from the agency's packages (stay_rates). The longest
 * package that fits sets the per-night price; an exact package is used as
 * is; never more than nights × the 1-night price. Mirrors Property.quote in
 * the app, which only previews: this is the price that is charged.
 */
create or replace function public.stay_quote(target_apartment uuid, nights integer)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base_night numeric;
  pkg record;
  total numeric;
begin
  select price::numeric / r.nights into base_night
  from public.stay_rates r where r.apartment_id = target_apartment
  order by r.nights asc limit 1;
  if base_night is null then
    raise exception 'this unit has no short-stay rates' using errcode = 'check_violation';
  end if;

  select r.nights, r.price into pkg
  from public.stay_rates r
  where r.apartment_id = target_apartment and r.nights <= stay_quote.nights
  order by r.nights desc limit 1;

  if not found then
    total := base_night * stay_quote.nights;
  elsif pkg.nights = stay_quote.nights then
    total := pkg.price;
  else
    total := pkg.price::numeric / pkg.nights * stay_quote.nights;
  end if;
  return least(round(total), round(base_night * stay_quote.nights))::bigint;
end;
$$;

grant execute on function public.stay_quote(uuid, integer) to anon, authenticated;

/**
 * A signed-in guest holds dates. Same lock and clash rule as the desk's
 * create_stay, so the app and the dashboard can never double book. The hold
 * lapses after 15 minutes unless paid; lapsed holds are cancelled here, on
 * the next booking of the same unit, so they never block anyone.
 */
create or replace function public.book_stay(target_apartment uuid, check_in_in date, check_out_in date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap record;
  u record;
  clash record;
  nights integer := check_out_in - check_in_in;
  amount bigint;
  new_stay uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in to book' using errcode = 'insufficient_privilege';
  end if;
  select * into ap from public.apartments where id = target_apartment;
  if not found or not ap.listed or not ap.short_stay then
    raise exception 'this unit cannot be booked by the night';
  end if;
  if check_in_in < current_date then
    raise exception 'check-in is in the past' using errcode = 'check_violation';
  end if;
  if nights < 1 or nights > 30 then
    raise exception 'a stay is 1 to 30 nights' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_apartment::text, 0));

  update public.stays
     set status = 'cancelled', notes = coalesce(notes || ' · ', '') || 'hold lapsed unpaid'
   where apartment_id = target_apartment and status = 'booked' and paid = 0
     and hold_expires_at is not null and hold_expires_at < now();

  select s.check_in into clash
  from public.stays s
  where s.apartment_id = target_apartment
    and s.status <> 'cancelled'
    and daterange(s.check_in, s.check_out, '[)') && daterange(check_in_in, check_out_in, '[)')
  order by s.check_in
  limit 1;
  if found then
    -- The app reads DETAIL as the first night that is taken.
    raise exception 'the unit is taken on these dates'
      using errcode = 'exclusion_violation', detail = greatest(clash.check_in, check_in_in)::text;
  end if;

  select id, email, raw_user_meta_data into u from auth.users where id = auth.uid();
  amount := public.stay_quote(target_apartment, nights);

  insert into public.stays
    (agency_id, apartment_id, guest_name, guest_phone, guest_email, check_in, check_out,
     amount, notes, created_by, guest_user_id, hold_expires_at, source)
  values
    (ap.agency_id, target_apartment,
     coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)),
     nullif(u.raw_user_meta_data ->> 'phone', ''),
     u.email,
     check_in_in, check_out_in, amount, 'Booked in the app', auth.uid(), auth.uid(),
     now() + interval '15 minutes', 'app')
  returning id into new_stay;

  return jsonb_build_object('stay_id', new_stay, 'amount', amount);
end;
$$;

grant execute on function public.book_stay(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Repairs from the app
-- ---------------------------------------------------------------------------

alter type report_channel add value if not exists 'app';
alter table tickets add column if not exists number bigint generated always as identity;
alter table tickets add column if not exists category text;
alter table tickets add column if not exists location text;
alter table tickets add column if not exists photo_paths text[] not null default '{}';
alter table tickets add column if not exists rating smallint check (rating between 1 and 5);

/** Opens a ticket on the resident's current home. */
create or replace function public.resident_create_ticket(
  title_in text,
  description_in text,
  category_in text,
  priority_in text,
  location_in text,
  photo_paths_in text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  t record;
begin
  select le.*, ap.building_id into l
  from public.leases le
  join public.apartments ap on ap.id = le.apartment_id
  where le.status = 'active' and le.resident_id in (select public.current_resident_ids())
  order by le.starts_on desc
  limit 1;
  if not found then
    raise exception 'no active lease to report on' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(title_in, ''))) = 0 then
    raise exception 'a ticket needs a title' using errcode = 'check_violation';
  end if;

  insert into public.tickets
    (agency_id, building_id, apartment_id, resident_id, title, description, priority,
     reported_via, category, location, photo_paths)
  values
    (l.agency_id, l.building_id, l.apartment_id, l.resident_id, btrim(title_in), description_in,
     coalesce(nullif(priority_in, ''), 'normal')::public.ticket_priority, 'app',
     category_in, location_in,
     -- Only the user's own uploads are accepted.
     coalesce(array(select p from unnest(photo_paths_in) p where p like auth.uid()::text || '/%'), '{}'))
  returning id, number into t;

  insert into public.ticket_messages (agency_id, ticket_id, direction, body)
  values (l.agency_id, t.id, 'inbound', description_in);

  return jsonb_build_object('id', t.id, 'number', t.number);
end;
$$;

/** A message from the resident on one of their tickets. */
create or replace function public.resident_ticket_message(ticket_in uuid, body_in text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  select id, agency_id into t from public.tickets
  where id = ticket_in and resident_id in (select public.current_resident_ids());
  if not found then
    raise exception 'not your ticket' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(body_in, ''))) = 0 then
    return;
  end if;
  insert into public.ticket_messages (agency_id, ticket_id, direction, body)
  values (t.agency_id, t.id, 'inbound', btrim(body_in));
end;
$$;

grant execute on function public.resident_create_ticket(text, text, text, text, text, text[]) to authenticated;
grant execute on function public.resident_ticket_message(uuid, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('ticket-photos', 'ticket-photos', false)
on conflict (id) do nothing;

drop policy if exists "residents upload own ticket photos" on storage.objects;
create policy "residents upload own ticket photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "residents read own ticket photos" on storage.objects;
create policy "residents read own ticket photos" on storage.objects for select to authenticated
  using (bucket_id = 'ticket-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "members read ticket photos" on storage.objects;
create policy "members read ticket photos" on storage.objects for select to authenticated
  using (bucket_id = 'ticket-photos' and exists (
    select 1 from public.tickets t
    where name = any (t.photo_paths) and t.agency_id in (select public.current_agency_ids())));

-- ---------------------------------------------------------------------------
-- 6. Asking to rent a listed home
-- ---------------------------------------------------------------------------

create table if not exists lease_requests (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  apartment_id uuid not null references apartments (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  move_in      date not null,
  months       smallint not null check (months between 1 and 60),
  status       text not null default 'submitted'
               check (status in ('submitted', 'reviewing', 'approved', 'declined', 'withdrawn')),
  created_at   timestamptz not null default now()
);
create index if not exists lease_requests_agency_idx on lease_requests (agency_id, created_at desc);
alter table lease_requests enable row level security;

drop policy if exists lease_requests_member_read on lease_requests;
create policy lease_requests_member_read on lease_requests for select
  using (agency_id in (select public.current_agency_ids()) or user_id = auth.uid());

drop policy if exists lease_requests_member_update on lease_requests;
create policy lease_requests_member_update on lease_requests for update
  using (public.has_role(agency_id, array['owner', 'manager']::public.member_role[]));

create or replace function public.request_lease(target_apartment uuid, move_in_in date, months_in integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap record;
  id_out uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  select * into ap from public.apartments where id = target_apartment and listed;
  if not found then
    raise exception 'this unit is not listed';
  end if;
  if move_in_in < greatest(current_date, coalesce(ap.available_from, current_date)) then
    raise exception 'move-in is before the unit is available' using errcode = 'check_violation';
  end if;
  insert into public.lease_requests (agency_id, apartment_id, user_id, move_in, months)
  values (ap.agency_id, target_apartment, auth.uid(), move_in_in, months_in)
  returning id into id_out;
  return id_out;
end;
$$;

grant execute on function public.request_lease(uuid, date, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Paying rent and stays online (settled by the web app only)
-- ---------------------------------------------------------------------------

create table if not exists resident_payments (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('rent', 'stay')),
  lease_id     uuid references leases (id) on delete set null,
  charge_ids   uuid[] not null default '{}',
  -- Months paid ahead that have no rent charge yet (first day of each month).
  advance_periods date[] not null default '{}',
  stay_id      uuid references stays (id) on delete set null,
  amount       bigint not null check (amount > 0),
  currency     char(3) not null,
  method       text not null check (method in ('mobile_money', 'card')),
  provider     text not null default 'payunit',
  provider_ref text not null unique,
  status       text not null default 'initiated'
               check (status in ('initiated', 'paid', 'failed', 'cancelled')),
  payment_id   uuid references payments (id) on delete set null,
  created_at   timestamptz not null default now(),
  settled_at   timestamptz,
  raw          jsonb
);
create index if not exists resident_payments_user_idx on resident_payments (user_id, created_at desc);
alter table resident_payments enable row level security;

drop policy if exists resident_payments_read on resident_payments;
create policy resident_payments_read on resident_payments for select
  using (user_id = auth.uid() or agency_id in (select public.current_agency_ids()));

/**
 * Called by the web app (service role) after PayUnit confirmed the outcome.
 * Idempotent: a second call for a settled payment changes nothing. A paid
 * rent payment becomes a row in `payments` allocated to the charges oldest
 * first, creating the charges for months paid ahead, so the dashboard sees it
 * like any payment recorded at the desk. A paid stay raises `stays.paid` and
 * ends its hold.
 */
create or replace function public.settle_resident_payment(payment_ref text, final_status text, raw_in jsonb default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rp record;
  l record;
  new_payment uuid;
  left_to_allocate bigint;
  c record;
  period date;
begin
  select * into rp from public.resident_payments where provider_ref = payment_ref for update;
  if not found then
    raise exception 'unknown payment %', payment_ref;
  end if;
  if rp.status <> 'initiated' then
    return rp.status;
  end if;
  if final_status not in ('paid', 'failed', 'cancelled') then
    raise exception 'unknown outcome %', final_status;
  end if;

  if final_status <> 'paid' then
    update public.resident_payments set status = final_status, settled_at = now(), raw = raw_in where id = rp.id;
    return final_status;
  end if;

  if rp.kind = 'stay' then
    update public.stays
       set paid = least(amount, paid + rp.amount), paid_on = current_date, hold_expires_at = null
     where id = rp.stay_id;
  else
    select * into l from public.leases where id = rp.lease_id;
    foreach period in array rp.advance_periods loop
      insert into public.rent_charges (agency_id, lease_id, period_start, period_end, amount, due_on)
      values (l.agency_id, l.id, period, (period + interval '1 month' - interval '1 day')::date,
              l.rent_amount, (period + (l.due_day - 1))::date)
      on conflict (lease_id, period_start) do nothing;
    end loop;

    insert into public.payments (agency_id, lease_id, amount, paid_on, method, reference)
    values (l.agency_id, l.id, rp.amount, current_date,
            -- PayUnit's answer names the network the resident chose.
            (case
               when rp.method = 'card' then 'card'
               when raw_in::text ilike '%orange%' then 'orange_money'
               else 'mtn_momo'
             end)::public.payment_method,
            'PayUnit ' || rp.provider_ref)
    returning id into new_payment;

    left_to_allocate := rp.amount;
    for c in
      select cs.rent_charge_id, cs.balance
      from public.v_charge_status cs
      where cs.lease_id = l.id and cs.balance > 0
        and (cs.rent_charge_id = any (rp.charge_ids) or cs.period_start = any (rp.advance_periods))
      order by cs.period_start
    loop
      exit when left_to_allocate <= 0;
      insert into public.payment_allocations (payment_id, rent_charge_id, agency_id, amount)
      values (new_payment, c.rent_charge_id, l.agency_id, least(c.balance, left_to_allocate));
      left_to_allocate := left_to_allocate - least(c.balance, left_to_allocate);
    end loop;
  end if;

  update public.resident_payments
     set status = 'paid', settled_at = now(), raw = raw_in, payment_id = new_payment
   where id = rp.id;
  return 'paid';
end;
$$;

revoke all on function public.settle_resident_payment(text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Devices, for push notifications
-- ---------------------------------------------------------------------------

create table if not exists resident_devices (
  user_id      uuid not null references auth.users (id) on delete cascade,
  platform     text not null check (platform in ('ios', 'android')),
  push_token   text,
  locale       text not null default 'fr',
  last_seen_at timestamptz not null default now(),
  primary key (user_id, platform)
);
alter table resident_devices enable row level security;

drop policy if exists resident_devices_own on resident_devices;
create policy resident_devices_own on resident_devices for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
