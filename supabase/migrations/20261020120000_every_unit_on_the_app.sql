-- Charta Home · every unit is on the app, published or not
--
-- The app showed only units an agency had switched on (apartments.listed),
-- which meant a flat could stand empty for a month while nobody could see
-- it, because the person who would have switched it on is the person with
-- too much to do. The flag is no longer a gate: every unit is on the app,
-- and the dates decide what can be done with it. A free unit can be taken
-- now; one with a tenant in it shows when it comes free.
--
-- This file removes the gate from the two places that let a guest book by
-- the night. Leasing one is in the migration that follows this one.

comment on column apartments.listed is
  'No longer a gate. Every unit is on the app; the dates decide what can be booked.';

-- Nights already taken at the given units, for the app's calendars. Dates
-- only: no guest name, phone or price ever leaves through here. Cancelled
-- stays and lapsed unpaid holds free their nights.
create or replace function public.listing_taken_nights(apartment_ids uuid[])
returns table (apartment_id uuid, check_in date, check_out date)
language sql
stable
security definer
set search_path = ''
as $$
  select s.apartment_id, s.check_in, s.check_out
  from public.stays s
  where s.apartment_id = any (apartment_ids)
    and s.status <> 'cancelled'
    and not (s.paid = 0 and s.hold_expires_at is not null and s.hold_expires_at < now())
    and s.check_out > current_date
$$;

grant execute on function public.listing_taken_nights(uuid[]) to anon, authenticated;

-- ------------------------------------------------------- booking by night
-- The `listed` gate is gone. What replaces it is a date question, because
-- that is the real one: a unit with a tenant until the end of November can
-- take a guest in December, and must not take one in October.
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
