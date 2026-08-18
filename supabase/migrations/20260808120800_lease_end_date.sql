-- Charta Home · lease end date
--
-- `leases.ends_on` has existed since the portfolio migration, with a check
-- that it cannot precede the start, but nothing could set it: create_lease
-- took no such argument and v_apartment_state never selected it. An agency
-- signing a fixed term lease had nowhere to record when the tenant leaves.

-- The view gains the column. Replaced rather than dropped, because
-- v_building_performance is built on top of it and a drop would take that
-- with it. create or replace can only append, so lease_ends_on goes last
-- even though it reads better beside lease_started_on.
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
  l.ends_on        as lease_ends_on
from apartments ap
left join leases l
  on l.apartment_id = ap.id and l.status = 'active'
left join residents r
  on r.id = l.resident_id;

-- Dropped rather than replaced: adding a defaulted parameter would leave the
-- old signature in place and make every existing call ambiguous.
drop function if exists public.create_lease(uuid, text, text, bigint, lease_cycle, date, bigint);

create function public.create_lease(
  target_apartment uuid,
  resident_name text,
  resident_phone text,
  rent bigint,
  cycle_in lease_cycle default 'monthly',
  starts_on_in date default current_date,
  deposit_in bigint default 0,
  ends_on_in date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap record;
  resident uuid;
  new_lease uuid;
begin
  select * into ap from public.apartments where id = target_apartment;
  if not found then
    raise exception 'apartment % not found', target_apartment;
  end if;
  if not public.has_role(ap.agency_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed to create leases for this agency';
  end if;

  -- A move out date before the move in date is a typo, not a lease.
  if ends_on_in is not null and ends_on_in < starts_on_in then
    raise exception 'lease cannot end before it starts';
  end if;

  select id into resident
  from public.residents
  where agency_id = ap.agency_id and phone_e164 = resident_phone
  limit 1;

  if resident is null then
    insert into public.residents (agency_id, full_name, phone_e164)
    values (ap.agency_id, resident_name, resident_phone)
    returning id into resident;
  end if;

  insert into public.leases (
    agency_id, apartment_id, resident_id, cycle, rent_amount, deposit,
    starts_on, ends_on, status
  )
  values (
    ap.agency_id, ap.id, resident, cycle_in, rent, deposit_in,
    starts_on_in, ends_on_in, 'active'
  )
  returning id into new_lease;

  perform public.ensure_rent_charge(new_lease, starts_on_in);

  return new_lease;
end;
$$;

grant execute on function public.create_lease to authenticated;
