-- ---------------------------------------------------------------------------
-- Every apartment in the app, and booking a monthly rental with payment.
--
-- Until now the app showed only apartments an agency had flagged `listed`,
-- and renting one only sent a request. Now every apartment is shown: a vacant
-- one can be booked from today, an occupied one from the day its lease ends.
-- Booking holds the unit for 15 minutes (the same rule as short stays) while
-- the resident pays the first month and the deposit through PayUnit; once
-- paid the request becomes a reservation the agency confirms in its
-- dashboard, and nobody else can book those months.
-- ---------------------------------------------------------------------------

-- Requests now carry what was paid, the hold, and how to reach the person:
-- agency staff cannot read auth.users, so the contact is copied here.
alter table lease_requests add column if not exists amount bigint check (amount >= 0);
alter table lease_requests add column if not exists paid bigint not null default 0 check (paid >= 0);
alter table lease_requests add column if not exists hold_expires_at timestamptz;
alter table lease_requests add column if not exists contact_name text;
alter table lease_requests add column if not exists contact_email text;
alter table lease_requests add column if not exists contact_phone text;

alter table lease_requests drop constraint if exists lease_requests_status_check;
alter table lease_requests add constraint lease_requests_status_check
  check (status in ('submitted', 'held', 'reserved', 'reviewing', 'approved', 'declined', 'withdrawn', 'lapsed'));

-- A paid reservation is money the agency holds: keep it if the account goes.
alter table lease_requests alter column user_id drop not null;
alter table lease_requests drop constraint if exists lease_requests_user_id_fkey;
alter table lease_requests
  add constraint lease_requests_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

create index if not exists lease_requests_apartment_idx on lease_requests (apartment_id, status);

alter table resident_payments add column if not exists lease_request_id uuid references lease_requests (id) on delete set null;
alter table resident_payments drop constraint if exists resident_payments_kind_check;
alter table resident_payments add constraint resident_payments_kind_check check (kind in ('rent', 'stay', 'booking'));

/**
 * First day an apartment can be let, or null when it is occupied by a lease
 * with no end date (the agency has to say when it frees up).
 * Counts active and upcoming leases, paid or approved reservations, and holds
 * still running; never earlier than today or the agency's own available_from.
 */
create or replace function public.apartment_free_from(apt uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.leases l
       where l.apartment_id = apt and l.status in ('active', 'upcoming') and l.ends_on is null
    ) then null
    else greatest(
      current_date,
      coalesce((select a.available_from from public.apartments a where a.id = apt), current_date),
      coalesce((select max(l.ends_on) + 1 from public.leases l
                 where l.apartment_id = apt and l.status in ('active', 'upcoming')), current_date),
      coalesce((select max((r.move_in + make_interval(months => r.months))::date) from public.lease_requests r
                 where r.apartment_id = apt
                   and (r.status in ('reserved', 'approved')
                        or (r.status = 'held' and r.hold_expires_at > now()))), current_date)
    )
  end;
$$;

/** Availability of many apartments at once, for the app's listing feed. */
create or replace function public.apartments_availability(ids uuid[])
returns table (apartment_id uuid, free_from date, occupied boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,
         public.apartment_free_from(a.id),
         exists (select 1 from public.leases l where l.apartment_id = a.id and l.status = 'active')
    from public.apartments a
   where a.id = any (ids);
$$;

revoke all on function public.apartment_free_from(uuid) from public, anon, authenticated;
revoke all on function public.apartments_availability(uuid[]) from public, anon, authenticated;
grant execute on function public.apartment_free_from(uuid) to service_role;
grant execute on function public.apartments_availability(uuid[]) to service_role;

/**
 * A signed-in resident books a monthly rental. Locks the apartment so two
 * people cannot book the same months, frees lapsed holds, and holds the unit
 * for 15 minutes while the first month and the deposit (two months, as the
 * app shows) are paid. Raises 23P01 with the first free day when the move-in
 * is too early.
 */
create or replace function public.book_lease(
  target_apartment uuid,
  move_in_in date,
  months_in integer,
  name_in text default null,
  phone_in text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap record;
  free date;
  stay_end date;
  usr record;
  id_out uuid;
  total bigint;
  until timestamptz := now() + interval '15 minutes';
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if months_in is null or months_in not between 1 and 60 then
    raise exception 'duration must be 1 to 60 months' using errcode = 'check_violation';
  end if;

  select * into ap from public.apartments where id = target_apartment for update;
  if not found then
    raise exception 'unknown apartment';
  end if;
  -- The same lock book_stay takes, so a night booking and a lease cannot
  -- take the same dates at the same moment.
  perform pg_advisory_xact_lock(hashtextextended(target_apartment::text, 0));
  if coalesce(ap.base_rent, 0) <= 0 then
    raise exception 'the agency has not set a rent for this unit' using errcode = 'check_violation';
  end if;

  update public.lease_requests set status = 'lapsed'
   where apartment_id = target_apartment and status = 'held' and hold_expires_at < now();
  -- Booking again replaces this person's own unpaid hold.
  update public.lease_requests set status = 'withdrawn'
   where apartment_id = target_apartment and status = 'held' and user_id = auth.uid();

  free := public.apartment_free_from(target_apartment);
  if free is null then
    raise exception 'occupied with no end date' using errcode = 'check_violation', detail = 'occupied';
  end if;
  if move_in_in < free then
    raise exception 'not free on that date' using errcode = '23P01', detail = free::text;
  end if;
  -- Guests booked by the night inside these months. Lapsed unpaid holds
  -- do not count. DETAIL is the day after the last such stay ends.
  select max(s.check_out) into stay_end
    from public.stays s
   where s.apartment_id = target_apartment
     and s.status <> 'cancelled'
     and not (s.paid = 0 and s.hold_expires_at is not null and s.hold_expires_at < now())
     and daterange(s.check_in, s.check_out, '[)')
         && daterange(move_in_in, (move_in_in + make_interval(months => months_in))::date, '[)');
  if stay_end is not null then
    raise exception 'guests are booked in those months' using errcode = '23P01', detail = stay_end::text;
  end if;

  select u.email, u.raw_user_meta_data into usr from auth.users u where u.id = auth.uid();
  total := ap.base_rent * 3;
  insert into public.lease_requests
    (agency_id, apartment_id, user_id, move_in, months, status, amount, hold_expires_at,
     contact_name, contact_email, contact_phone)
  values
    (ap.agency_id, target_apartment, auth.uid(), move_in_in, months_in, 'held', total, until,
     coalesce(nullif(btrim(name_in), ''), nullif(btrim(usr.raw_user_meta_data ->> 'full_name'), ''), split_part(usr.email, '@', 1)),
     usr.email,
     coalesce(nullif(btrim(phone_in), ''), nullif(usr.raw_user_meta_data ->> 'phone', '')))
  returning id into id_out;

  return jsonb_build_object('request_id', id_out, 'amount', total, 'hold_expires_at', until);
end;
$$;

revoke all on function public.book_lease(uuid, date, integer, text, text) from public, anon;
grant execute on function public.book_lease(uuid, date, integer, text, text) to authenticated;

/**
 * Asking without paying, for a unit whose lease has no end date yet: any
 * apartment now, not only listed ones. A date before a known free day is
 * still refused.
 */
create or replace function public.request_lease(target_apartment uuid, move_in_in date, months_in integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap record;
  free date;
  id_out uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  select * into ap from public.apartments where id = target_apartment;
  if not found then
    raise exception 'unknown apartment';
  end if;
  free := public.apartment_free_from(target_apartment);
  if free is not null and move_in_in < free then
    raise exception 'move-in is before the unit is available' using errcode = 'check_violation';
  end if;
  insert into public.lease_requests (agency_id, apartment_id, user_id, move_in, months, contact_email)
  values (ap.agency_id, target_apartment, auth.uid(), move_in_in, months_in,
          (select u.email from auth.users u where u.id = auth.uid()))
  returning id into id_out;
  return id_out;
end;
$$;

grant execute on function public.request_lease(uuid, date, integer) to authenticated;

/** Same settlement as before, plus bookings: a paid hold becomes a reservation. */
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
  elsif rp.kind = 'booking' then
    update public.lease_requests
       set status = 'reserved', paid = paid + rp.amount, hold_expires_at = null
     where id = rp.lease_request_id;
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

-- ------------------------------------------------------- booking by night
-- book_stay as in 20261020120000_every_unit_on_the_app.sql, plus one check:
-- months a resident has reserved, or holds while paying, are not free for
-- a guest either. It lives here because those columns are added above.
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
  let record;
  booked date;
  nights integer := check_out_in - check_in_in;
  amount bigint;
  new_stay uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in to book' using errcode = 'insufficient_privilege';
  end if;
  select * into ap from public.apartments where id = target_apartment;
  if not found or not ap.short_stay then
    raise exception 'this unit cannot be booked by the night';
  end if;
  if check_in_in < current_date then
    raise exception 'check-in is in the past' using errcode = 'check_violation';
  end if;
  if nights < 1 or nights > 30 then
    raise exception 'a stay is 1 to 30 nights' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_apartment::text, 0));

  -- A tenancy covering these nights. An open ended lease covers everything
  -- after it starts, which is what `infinity` says here.
  select l.starts_on, l.ends_on into let
  from public.leases l
  where l.apartment_id = target_apartment
    and l.status in ('upcoming', 'active')
    and daterange(l.starts_on, coalesce(l.ends_on, 'infinity'::date), '[)')
        && daterange(check_in_in, check_out_in, '[)')
  order by l.starts_on
  limit 1;
  if found then
    -- The app reads DETAIL as the first date that is taken.
    raise exception 'the unit is let on these dates'
      using errcode = 'exclusion_violation',
            detail = greatest(let.starts_on, check_in_in)::text;
  end if;

  -- Months reserved in the app, approved, or held while being paid.
  select min(r.move_in) into booked
  from public.lease_requests r
  where r.apartment_id = target_apartment
    and (r.status in ('reserved', 'approved') or (r.status = 'held' and r.hold_expires_at > now()))
    and daterange(r.move_in, (r.move_in + make_interval(months => r.months))::date, '[)')
        && daterange(check_in_in, check_out_in, '[)');
  if booked is not null then
    raise exception 'the unit is reserved on these dates'
      using errcode = 'exclusion_violation', detail = greatest(booked, check_in_in)::text;
  end if;

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
