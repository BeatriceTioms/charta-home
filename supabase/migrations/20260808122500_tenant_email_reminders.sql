-- Charta Home · a tenant's email, and the reminder that uses it
--
-- The reminder job could reach nobody: WhatsApp needs Meta's approval and
-- SMS has no sender, so every reminder was handed to the agency to forward
-- by hand. An email address is the one channel that works today. The
-- residents table has carried an email column since the start; nothing
-- wrote to it. Now the lease form does, and the views the reminder job and
-- the dashboard read carry it out again.

-- A malformed address would sit silently until the first reminder bounced.
alter table residents
  drop constraint if exists residents_email_shape;
alter table residents
  add constraint residents_email_shape
  check (email is null or email::text ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- ----------------------------------------------------------- create_lease
-- The signature changes, which `create or replace` will not do.
drop function if exists public.create_lease(uuid, text, text, bigint, lease_cycle, date, bigint, date);

create or replace function public.create_lease(
  target_apartment uuid,
  resident_name text,
  resident_phone text,
  rent bigint,
  cycle_in lease_cycle default 'monthly',
  starts_on_in date default current_date,
  deposit_in bigint default 0,
  ends_on_in date default null,
  resident_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap record;
  resident uuid;
  existing_name text;
  existing_email text;
  new_lease uuid;
  clean_name text := btrim(coalesce(resident_name, ''));
  clean_phone text := nullif(btrim(coalesce(resident_phone, '')), '');
  clean_email text := nullif(lower(btrim(coalesce(resident_email, ''))), '');
begin
  select * into ap from public.apartments where id = target_apartment;
  if not found then
    raise exception 'apartment % not found', target_apartment;
  end if;
  if not public.has_role(ap.agency_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed to create leases for this agency';
  end if;

  if clean_name = '' then
    raise exception 'a tenant needs a name'
      using errcode = 'check_violation';
  end if;

  if ends_on_in is not null and ends_on_in < starts_on_in then
    raise exception 'lease cannot end before it starts';
  end if;

  if clean_phone is not null then
    select id, full_name, email::text into resident, existing_name, existing_email
    from public.residents
    where agency_id = ap.agency_id and phone_e164 = clean_phone
    limit 1;
  end if;

  if resident is null then
    insert into public.residents (agency_id, full_name, phone_e164, email)
    values (ap.agency_id, clean_name, clean_phone, clean_email)
    returning id into resident;
  else
    -- Same number: believe the person entering it about the name, and
    -- record an address when one is given. A blank address does not erase
    -- one that is already on file.
    update public.residents
       set full_name = clean_name,
           email = coalesce(clean_email, email)
     where id = resident
       and (full_name is distinct from clean_name
            or (clean_email is not null and email is distinct from clean_email));
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

-- ---------------------------------------------------- the views carry it
-- Columns are appended, which is the one change `create or replace view`
-- allows, so nothing that reads these by position moves.
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
  r.email::text    as resident_email
from apartments ap
left join leases l
  on l.apartment_id = ap.id and l.status = 'active'
left join residents r
  on r.id = l.resident_id;

create or replace view v_reminder_targets
with (security_invoker = true)
as
select
  rc.id            as rent_charge_id,
  rc.agency_id,
  rc.due_on,
  rc.amount,
  ag.name          as agency_name,
  ag.whatsapp_number as agency_whatsapp,
  ag.currency,
  r.full_name      as resident_name,
  r.phone_e164     as resident_phone,
  ap.label         as apartment_label,
  r.email::text    as resident_email,
  ag.locale        as agency_locale,
  ag.email         as agency_email
from rent_charges rc
join leases l    on l.id = rc.lease_id
join residents r on r.id = l.resident_id
join apartments ap on ap.id = l.apartment_id
join agencies ag on ag.id = rc.agency_id;
