-- Charta Home · letting a unit by the night
--
-- Everything so far assumes a tenancy: a lease, a cycle, a rent charge every
-- period, a reminder when it is late. A guest who takes a flat for three
-- nights has none of that. Forcing a stay into a lease would raise daily rent
-- charges, chase the guest for arrears, and leave the flat reading as occupied
-- by a tenant who left on Tuesday.
--
-- So a stay is its own thing. A unit can be let long term, by the night, or
-- both at different times of the year, and the agency sets its own durations
-- and prices: one night, three nights, a week, whatever it sells.

alter table apartments
  add column if not exists short_stay boolean not null default false;

comment on column apartments.short_stay is
  'Whether this unit is offered by the night. A unit can still hold a lease.';

-- ---------------------------------------------------------- the price list
-- The agency's own durations. Not a nightly rate with discounts applied by
-- arithmetic nobody asked for: whatever packages they sell, at the price they
-- sell them, and nothing in between is invented.
create table if not exists stay_rates (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  apartment_id uuid not null references apartments (id) on delete cascade,
  nights       integer not null check (nights between 1 and 365),
  price        bigint not null check (price > 0),
  created_at   timestamptz not null default now(),
  unique (apartment_id, nights)
);

create index if not exists stay_rates_apartment_idx on stay_rates (apartment_id, nights);

comment on table stay_rates is
  'What a unit costs for a given number of nights. One row per package the agency sells.';

-- ---------------------------------------------------------------- the stays
create table if not exists stays (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  apartment_id uuid not null references apartments (id) on delete cascade,
  guest_name   text not null check (length(btrim(guest_name)) > 0),
  guest_phone  text check (guest_phone ~ '^\+[1-9][0-9]{6,14}$'),
  guest_email  citext check (guest_email is null or guest_email::text ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  check_in     date not null,
  check_out    date not null,
  -- What was agreed, and what has actually been received. A stay booked for
  -- next month is money promised, not money collected, which is why the
  -- performance views count `paid` and never `amount`.
  amount       bigint not null check (amount >= 0),
  paid         bigint not null default 0 check (paid >= 0),
  paid_on      date,
  status       text not null default 'booked'
               check (status in ('booked', 'checked_in', 'checked_out', 'cancelled')),
  notes        text,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint stays_nights_positive check (check_out > check_in),
  constraint stays_paid_within_amount check (paid <= amount)
);

create index if not exists stays_apartment_idx on stays (apartment_id, check_in);
create index if not exists stays_agency_idx on stays (agency_id, check_in desc);

drop trigger if exists stays_touch on stays;
create trigger stays_touch before update on stays
  for each row execute function public.touch_updated_at();

comment on table stays is
  'One guest in one unit between two dates. Nights are check_out minus check_in; the night of check out is not charged.';

-- ------------------------------------------------------------ row security
alter table stay_rates enable row level security;
alter table stays      enable row level security;

drop policy if exists stay_rates_read on stay_rates;
create policy stay_rates_read on stay_rates for select
  using (agency_id in (select public.current_agency_ids()));
drop policy if exists stay_rates_write on stay_rates;
create policy stay_rates_write on stay_rates for all
  using (public.has_role(agency_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_role(agency_id, array['owner', 'manager']::public.member_role[]));

drop policy if exists stays_read on stays;
create policy stays_read on stays for select
  using (agency_id in (select public.current_agency_ids()));
-- Writes go through the functions below, which hold the lock that keeps two
-- guests out of one flat. Nothing writes this table directly.

-- ------------------------------------------------------- booking a stay
/**
 * Books a guest into a unit.
 *
 * The clash check and the insert happen under a lock on the apartment, so two
 * people booking the same week in the same second cannot both succeed. A
 * cancelled stay holds no dates; everything else does, including one that has
 * already finished, because a guest cannot have been in two places at once.
 *
 * The price is given rather than derived. The rate list is what the form
 * offers and what the agency publishes; the amount on the stay is whatever
 * they actually agreed, which is sometimes neither.
 */
create or replace function public.create_stay(
  target_apartment uuid,
  guest_name_in text,
  check_in_in date,
  check_out_in date,
  amount_in bigint,
  guest_phone_in text default null,
  guest_email_in text default null,
  paid_in bigint default 0,
  paid_on_in date default null,
  notes_in text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap record;
  clash record;
  new_stay uuid;
  clean_name text := btrim(coalesce(guest_name_in, ''));
  clean_phone text := nullif(btrim(coalesce(guest_phone_in, '')), '');
  clean_email text := nullif(lower(btrim(coalesce(guest_email_in, ''))), '');
begin
  select * into ap from public.apartments where id = target_apartment;
  if not found then
    raise exception 'apartment % not found', target_apartment;
  end if;
  if not public.has_role(ap.agency_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed to book stays for this agency';
  end if;
  if clean_name = '' then
    raise exception 'a stay needs a guest name' using errcode = 'check_violation';
  end if;
  if check_out_in <= check_in_in then
    raise exception 'a stay must end after it begins' using errcode = 'check_violation';
  end if;
  if amount_in < 0 or coalesce(paid_in, 0) > amount_in then
    raise exception 'what was paid cannot exceed what was agreed' using errcode = 'check_violation';
  end if;

  -- One booking at a time per unit, so the check below is the truth by the
  -- time the insert lands. Transaction scoped: it lifts on commit.
  perform pg_advisory_xact_lock(hashtextextended(target_apartment::text, 0));

  select s.id, s.guest_name, s.check_in, s.check_out into clash
  from public.stays s
  where s.apartment_id = target_apartment
    and s.status <> 'cancelled'
    -- Half open: a guest leaving on the 5th frees the night of the 5th.
    and daterange(s.check_in, s.check_out, '[)') && daterange(check_in_in, check_out_in, '[)')
  limit 1;

  if found then
    raise exception 'the unit is taken from % to % by %',
      to_char(clash.check_in, 'DD/MM/YYYY'), to_char(clash.check_out, 'DD/MM/YYYY'), clash.guest_name
      using errcode = 'exclusion_violation';
  end if;

  insert into public.stays
    (agency_id, apartment_id, guest_name, guest_phone, guest_email,
     check_in, check_out, amount, paid, paid_on, notes, created_by)
  values
    (ap.agency_id, target_apartment, clean_name, clean_phone, clean_email,
     check_in_in, check_out_in, amount_in, coalesce(paid_in, 0),
     case when coalesce(paid_in, 0) > 0 then coalesce(paid_on_in, current_date) else null end,
     nullif(btrim(coalesce(notes_in, '')), ''), auth.uid())
  returning id into new_stay;

  -- Booking a unit by the night is what makes it a short stay unit. An
  -- agency should not have to set a flag before it can take a booking.
  update public.apartments set short_stay = true where id = target_apartment and short_stay = false;

  return new_stay;
end;
$$;

grant execute on function public.create_stay to authenticated;

/** Money received against a stay, and where the stay has got to. */
create or replace function public.update_stay(
  stay_id uuid,
  paid_in bigint default null,
  paid_on_in date default null,
  status_in text default null,
  notes_in text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
begin
  select * into s from public.stays where id = stay_id;
  if not found then
    raise exception 'stay % not found', stay_id;
  end if;
  if not public.has_role(s.agency_id, array['owner', 'manager', 'accountant']::public.member_role[]) then
    raise exception 'not allowed to change stays for this agency';
  end if;
  if status_in is not null and status_in not in ('booked', 'checked_in', 'checked_out', 'cancelled') then
    raise exception 'unknown stay status %', status_in;
  end if;
  if paid_in is not null and (paid_in < 0 or paid_in > s.amount) then
    raise exception 'what was paid cannot exceed what was agreed' using errcode = 'check_violation';
  end if;

  update public.stays
     set paid    = coalesce(paid_in, paid),
         paid_on = case
                     when paid_in is null then paid_on
                     when paid_in > 0 then coalesce(paid_on_in, paid_on, current_date)
                     else null
                   end,
         status  = coalesce(status_in, status),
         notes   = case when notes_in is null then notes else nullif(btrim(notes_in), '') end
   where id = stay_id;
end;
$$;

grant execute on function public.update_stay to authenticated;

-- ------------------------------------------------- what a unit is doing now
-- Appended, which is the one change `create or replace view` allows. The
-- lease columns keep their meaning exactly: a short stay is not a tenancy,
-- and the vacancy and yield figures for long lets must not move because a
-- guest arrived on Friday.
create or replace view v_apartment_state
with (security_invoker = true)
as
select
  ap.id            as apartment_id,
  ap.agency_id,
  ap.building_id,
  ap.label,
  ap.rooms,
  ap.bathrooms,
  ap.sqm,
  ap.base_rent,
  l.id             as lease_id,
  l.cycle,
  l.rent_amount,
  r.id             as resident_id,
  r.full_name      as resident_name,
  r.phone_e164     as resident_phone,
  l.starts_on      as lease_started_on,
  (l.id is not null) as is_occupied,
  case
    when l.id is null then null
    else (
      select cs.state
      from v_charge_status cs
      where cs.lease_id = l.id
      order by cs.period_start desc
      limit 1
    )
  end as rent_state,
  l.ends_on        as lease_ends_on,
  r.email::text    as resident_email,
  ap.short_stay    as short_stay,
  now_stay.id          as stay_id,
  now_stay.guest_name  as stay_guest,
  now_stay.check_in    as stay_from,
  now_stay.check_out   as stay_until,
  next_stay.check_in   as next_stay_from,
  next_stay.guest_name as next_stay_guest
from apartments ap
left join leases l
  on l.apartment_id = ap.id and l.status = 'active'
left join residents r
  on r.id = l.resident_id
left join lateral (
  select s.id, s.guest_name, s.check_in, s.check_out
  from stays s
  where s.apartment_id = ap.id
    and s.status <> 'cancelled'
    and current_date >= s.check_in and current_date < s.check_out
  order by s.check_in
  limit 1
) now_stay on true
left join lateral (
  select s.check_in, s.guest_name
  from stays s
  where s.apartment_id = ap.id
    and s.status <> 'cancelled'
    and s.check_in > current_date
  order by s.check_in
  limit 1
) next_stay on true;

-- -------------------------------------------- money a unit took by the night
-- Counted as paid rather than as agreed, and dated by when it was received,
-- so a booking taken in December for March is not March's income in advance.
create or replace view v_apartment_performance
with (security_invoker = true)
as
select
  ap.id                                        as apartment_id,
  ap.agency_id,
  ap.building_id,
  (coalesce(collected.total, 0) + coalesce(stay_year.total, 0))::bigint  as collected_ytd,
  coalesce(spent.total, 0)::bigint             as expenses_ytd,
  (coalesce(collected.total, 0) + coalesce(stay_year.total, 0) - coalesce(spent.total, 0))::bigint as net_ytd,
  case
    when (coalesce(collected.total, 0) + coalesce(stay_year.total, 0)) > 0
      then round(
        ((coalesce(collected.total, 0) + coalesce(stay_year.total, 0) - coalesce(spent.total, 0))::numeric
          / (coalesce(collected.total, 0) + coalesce(stay_year.total, 0))) * 100,
        1
      )
    else null
  end                                          as net_margin_pct,
  coalesce(life.tenants, 0)::integer           as tenants_ever,
  life.first_lease_on                          as first_lease_on,
  life.last_lease_ended_on                     as last_lease_ended_on,
  (coalesce(life.collected, 0) + coalesce(stay_life.total, 0))::bigint   as collected_lifetime,
  coalesce(life.payments, 0)::integer          as payments_count,
  life.last_payment_on                         as last_payment_on,
  coalesce(spent_life.total, 0)::bigint        as expenses_lifetime,
  coalesce(tk.total, 0)::integer               as tickets_total,
  coalesce(tk.open, 0)::integer                as tickets_open,
  coalesce(stay_life.guests, 0)::integer       as guests_ever,
  coalesce(stay_life.nights, 0)::integer       as nights_let,
  coalesce(stay_year.nights, 0)::integer       as nights_let_ytd
from apartments ap
left join lateral (
  select sum(p.amount) as total
  from payments p
  join leases l on l.id = p.lease_id
  where l.apartment_id = ap.id
    and p.paid_on >= date_trunc('year', current_date)
) collected on true
left join lateral (
  select sum(e.amount) as total
  from expenses e
  where e.apartment_id = ap.id
    and e.incurred_on >= date_trunc('year', current_date)
) spent on true
left join lateral (
  select
    count(distinct l.resident_id)                                   as tenants,
    min(l.starts_on)                                                as first_lease_on,
    max(l.ends_on) filter (where l.status = 'ended')                as last_lease_ended_on,
    (select sum(p.amount) from payments p where p.lease_id in (select id from leases where apartment_id = ap.id)) as collected,
    (select count(*)     from payments p where p.lease_id in (select id from leases where apartment_id = ap.id)) as payments,
    (select max(p.paid_on) from payments p where p.lease_id in (select id from leases where apartment_id = ap.id)) as last_payment_on
  from leases l
  where l.apartment_id = ap.id
) life on true
left join lateral (
  select sum(e.amount) as total
  from expenses e
  where e.apartment_id = ap.id
) spent_life on true
left join lateral (
  select count(*) as total,
         count(*) filter (where t.status not in ('resolved', 'cancelled')) as open
  from tickets t
  where t.apartment_id = ap.id
) tk on true
left join lateral (
  select sum(s.paid) as total,
         count(*) as guests,
         sum(s.check_out - s.check_in) as nights
  from stays s
  where s.apartment_id = ap.id and s.status <> 'cancelled'
) stay_life on true
left join lateral (
  select sum(s.paid) as total,
         sum(s.check_out - s.check_in) as nights
  from stays s
  where s.apartment_id = ap.id and s.status <> 'cancelled'
    and s.paid > 0 and s.paid_on >= date_trunc('year', current_date)
) stay_year on true;

comment on view v_apartment_performance is
  'Per unit money in and money out for the current year, nights let included, and what the unit has been over its life.';

-- A building earns what its units earn, by lease and by the night alike.
-- The yield denominator is untouched: market value, falling back to what the
-- building cost, exactly as before.
create or replace view v_building_performance
with (security_invoker = true)
as
select
  b.id                            as building_id,
  b.agency_id,
  b.name,
  count(ap.id)                    as apartment_count,
  count(ap.id) filter (where st.is_occupied) as occupied_count,
  coalesce(sum(ap.sqm), 0)        as total_sqm,
  (
    coalesce(
      (
        select sum(p.amount) from payments p
        join leases l2 on l2.id = p.lease_id
        join apartments ap2 on ap2.id = l2.apartment_id
        where ap2.building_id = b.id
          and p.paid_on >= date_trunc('year', current_date)
      ), 0
    )
    + coalesce(
      (
        select sum(s.paid) from stays s
        join apartments ap3 on ap3.id = s.apartment_id
        where ap3.building_id = b.id and s.status <> 'cancelled'
          and s.paid > 0 and s.paid_on >= date_trunc('year', current_date)
      ), 0
    )
  )::bigint                        as income_ytd,
  coalesce(
    (
      select sum(e.amount) from expenses e
      where e.building_id = b.id
        and e.incurred_on >= date_trunc('year', current_date)
    ), 0
  )::bigint                        as expenses_ytd,
  case
    when coalesce(b.market_value, b.acquisition_value, 0) > 0 then
      round(
        (
          coalesce(
            (
              select sum(p.amount) from payments p
              join leases l3 on l3.id = p.lease_id
              join apartments ap4 on ap4.id = l3.apartment_id
              where ap4.building_id = b.id
                and p.paid_on >= date_trunc('year', current_date)
            ), 0
          )
          + coalesce(
            (
              select sum(s.paid) from stays s
              join apartments ap5 on ap5.id = s.apartment_id
              where ap5.building_id = b.id and s.status <> 'cancelled'
                and s.paid > 0 and s.paid_on >= date_trunc('year', current_date)
            ), 0
          )
          - coalesce(
            (
              select sum(e.amount) from expenses e
              where e.building_id = b.id
                and e.incurred_on >= date_trunc('year', current_date)
            ), 0
          )
        )::numeric * 100 / coalesce(b.market_value, b.acquisition_value),
        2
      )
    else null
  end                              as net_yield_pct
from buildings b
left join apartments ap on ap.building_id = b.id
left join v_apartment_state st on st.apartment_id = ap.id
group by b.id;
