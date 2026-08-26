-- Charta Home · the tenant you typed is the tenant you get
--
-- Adding a tenant to a flat showed somebody else's name. create_lease looked
-- for a resident with the same phone number, and when it found one it reused
-- that row and dropped the name that had just been typed on the floor. So an
-- agency entering a new tenant with a number already in the book got the
-- previous tenant's name on the lease, with nothing said about it.
--
-- The number is still the identity, and it has to be: the WhatsApp webhook
-- finds a tenant by the number they message from, and two residents sharing
-- one number would make that ambiguous. What changes is that the name is not
-- silently discarded. The agency has just said what this person is called, so
-- the record is brought into line with what they said.
--
-- And a blank phone became the empty string, which the column's own check
-- refuses, so a tenant without a number could not be added at all. Blank now
-- means null, which is what "we do not have a number for them" is stored as.

create or replace function public.create_lease(
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
  existing_name text;
  new_lease uuid;
  clean_name text := btrim(coalesce(resident_name, ''));
  clean_phone text := nullif(btrim(coalesce(resident_phone, '')), '');
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

  -- A move out date before the move in date is a typo, not a lease.
  if ends_on_in is not null and ends_on_in < starts_on_in then
    raise exception 'lease cannot end before it starts';
  end if;

  -- Only look for an existing tenant when there is a number to look them up
  -- by. Without one, every tenant with no phone would collapse into whichever
  -- of them was entered first.
  if clean_phone is not null then
    select id, full_name into resident, existing_name
    from public.residents
    where agency_id = ap.agency_id and phone_e164 = clean_phone
    limit 1;
  end if;

  if resident is null then
    insert into public.residents (agency_id, full_name, phone_e164)
    values (ap.agency_id, clean_name, clean_phone)
    returning id into resident;
  elsif existing_name is distinct from clean_name then
    -- Same number, different name. Believe the person entering it: they are
    -- looking at the tenancy agreement, and this is the only place the name
    -- can be corrected without hunting for the tenant first.
    update public.residents set full_name = clean_name where id = resident;
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

/**
 * Who a phone number already belongs to, within the caller's own agency.
 *
 * So the lease form can say "this number is already on file for Beatrice
 * Tiomela" while it is being typed, rather than the agency discovering it
 * after the fact by reading a name they did not enter. Returns nothing when
 * the number is free, and is scoped by membership like everything else.
 */
create or replace function public.resident_by_phone(
  target_agency uuid,
  phone text
)
returns table (resident_id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clean_phone text := nullif(btrim(coalesce(phone, '')), '');
begin
  if not public.is_member(target_agency) then
    raise exception 'not a member of this agency';
  end if;
  if clean_phone is null then
    return;
  end if;

  return query
    select r.id, r.full_name
    from public.residents r
    where r.agency_id = target_agency and r.phone_e164 = clean_phone
    limit 1;
end;
$$;

grant execute on function public.resident_by_phone to authenticated;
