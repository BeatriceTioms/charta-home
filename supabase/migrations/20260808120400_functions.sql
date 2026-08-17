-- Charta Home · transactional functions
-- Anything that has to hold an invariant lives here rather than in the app, so
-- the rule cannot be bypassed by a different caller.

-- ------------------------------------------------- agency creation on signup

create or replace function public.create_agency_for_current_user(
  agency_name text,
  agency_country text default 'Guinea',
  agency_city text default 'Conakry',
  agency_currency char(3) default 'GNF',
  agency_locale text default 'fr',
  owner_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_agency uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.agencies (name, country, city, currency, locale)
  values (agency_name, agency_country, agency_city, agency_currency, agency_locale)
  returning id into new_agency;

  insert into public.memberships (user_id, agency_id, role, full_name)
  values (auth.uid(), new_agency, 'owner', owner_name);

  insert into public.subscriptions (agency_id, plan, status)
  values (new_agency, 'growth', 'trialing');

  -- Sensible French first reminder cadence for a Guinea launch.
  insert into public.reminder_rules (agency_id, offset_days, channel, escalation_step) values
    (new_agency, -3, 'whatsapp', 0),
    (new_agency,  0, 'whatsapp', 0),
    (new_agency,  5, 'whatsapp', 1),
    (new_agency, 10, 'whatsapp', 2);

  return new_agency;
end;
$$;

revoke all on function public.create_agency_for_current_user from public;
grant execute on function public.create_agency_for_current_user to authenticated;

-- --------------------------------------------------------- lease and charges

-- Generate the rent charge for one lease and one period, idempotently.
create or replace function public.ensure_rent_charge(
  target_lease uuid,
  period date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  start_on date;
  end_on date;
  charge_id uuid;
begin
  select * into l from public.leases where id = target_lease;
  if not found then
    raise exception 'lease % not found', target_lease;
  end if;
  if not public.is_member(l.agency_id) then
    raise exception 'not a member of this agency';
  end if;

  if l.cycle = 'monthly' then
    start_on := date_trunc('month', period)::date;
    end_on := (date_trunc('month', period) + interval '1 month - 1 day')::date;
  else
    start_on := date_trunc('year', period)::date;
    end_on := (date_trunc('year', period) + interval '1 year - 1 day')::date;
  end if;

  insert into public.rent_charges (agency_id, lease_id, period_start, period_end, amount, due_on)
  values (
    l.agency_id,
    l.id,
    start_on,
    end_on,
    l.rent_amount,
    (start_on + (l.due_day - 1) * interval '1 day')::date
  )
  on conflict (lease_id, period_start) do nothing
  returning id into charge_id;

  if charge_id is null then
    select id into charge_id
    from public.rent_charges
    where lease_id = l.id and period_start = start_on;
  end if;

  return charge_id;
end;
$$;

grant execute on function public.ensure_rent_charge to authenticated;

-- Record a payment and allocate it across the oldest open charges first.
create or replace function public.record_payment(
  target_lease uuid,
  payment_amount bigint,
  payment_method_in payment_method default 'cash',
  paid_on_in date default current_date,
  reference_in text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  new_payment uuid;
  remaining bigint := payment_amount;
  c record;
  take bigint;
begin
  if payment_amount <= 0 then
    raise exception 'payment amount must be positive';
  end if;

  select * into l from public.leases where id = target_lease;
  if not found then
    raise exception 'lease % not found', target_lease;
  end if;
  if not public.has_role(l.agency_id, array['owner', 'manager', 'accountant']::public.member_role[]) then
    raise exception 'not allowed to record payments for this agency';
  end if;

  insert into public.payments (agency_id, lease_id, amount, paid_on, method, reference, recorded_by)
  values (l.agency_id, l.id, payment_amount, paid_on_in, payment_method_in, reference_in, auth.uid())
  returning id into new_payment;

  -- Make sure the current period exists before allocating.
  perform public.ensure_rent_charge(l.id, paid_on_in);

  for c in
    select cs.rent_charge_id, cs.balance
    from public.v_charge_status cs
    where cs.lease_id = l.id and cs.balance > 0 and cs.state <> 'void'
    order by cs.period_start asc
  loop
    exit when remaining <= 0;
    take := least(remaining, c.balance);

    insert into public.payment_allocations (payment_id, rent_charge_id, agency_id, amount)
    values (new_payment, c.rent_charge_id, l.agency_id, take)
    on conflict (payment_id, rent_charge_id)
      do update set amount = payment_allocations.amount + excluded.amount;

    remaining := remaining - take;
  end loop;

  -- Mark fully settled charges so reminder jobs can skip them cheaply.
  update public.rent_charges rc
  set status = 'paid'
  where rc.lease_id = l.id
    and rc.status = 'open'
    and rc.amount <= (
      select coalesce(sum(a.amount), 0)
      from public.payment_allocations a
      where a.rent_charge_id = rc.id
    );

  return new_payment;
end;
$$;

grant execute on function public.record_payment to authenticated;

-- Create a lease and its first charge in one call.
create or replace function public.create_lease(
  target_apartment uuid,
  resident_name text,
  resident_phone text,
  rent bigint,
  cycle_in lease_cycle default 'monthly',
  starts_on_in date default current_date,
  deposit_in bigint default 0
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
    agency_id, apartment_id, resident_id, cycle, rent_amount, deposit, starts_on, status
  )
  values (ap.agency_id, ap.id, resident, cycle_in, rent, deposit_in, starts_on_in, 'active')
  returning id into new_lease;

  perform public.ensure_rent_charge(new_lease, starts_on_in);

  return new_lease;
end;
$$;

grant execute on function public.create_lease to authenticated;

-- Resolve a ticket and book its cost as an expense in one step.
create or replace function public.resolve_ticket(
  target_ticket uuid,
  final_cost bigint default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tk record;
begin
  select * into tk from public.tickets where id = target_ticket;
  if not found then
    raise exception 'ticket % not found', target_ticket;
  end if;
  if not public.is_member(tk.agency_id) then
    raise exception 'not a member of this agency';
  end if;

  update public.tickets
  set status = 'resolved', resolved_at = now(), cost = final_cost
  where id = target_ticket;

  if final_cost > 0 then
    insert into public.expenses (
      agency_id, building_id, apartment_id, ticket_id, category, amount, description
    )
    values (
      tk.agency_id, tk.building_id, tk.apartment_id, tk.id, 'maintenance', final_cost, tk.title
    );
  end if;
end;
$$;

grant execute on function public.resolve_ticket to authenticated;

-- --------------------------------------------------------- plan enforcement

create or replace function public.enforce_building_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed integer;
  used integer;
begin
  select pl.max_buildings into allowed
  from public.subscriptions s
  join public.plan_limits pl on pl.plan = s.plan
  where s.agency_id = new.agency_id;

  if allowed is null then
    return new;
  end if;

  select count(*) into used from public.buildings where agency_id = new.agency_id;

  if used >= allowed then
    raise exception 'plan limit reached: % buildings allowed on this plan', allowed
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger buildings_plan_limit before insert on buildings
  for each row execute function public.enforce_building_limit();
