-- Charta Home · quarterly leases
--
-- The cycle only ever offered monthly or yearly. Agencies in Conakry commonly
-- let on a three month term, which had to be recorded as monthly and then
-- corrected by hand every quarter. This adds the term the market actually uses.

-- Postgres allows a new enum value inside a transaction but forbids using it as
-- a literal in that same transaction. Every comparison below therefore goes
-- through text, which is settled at run time and so is safe to write here.
alter type lease_cycle add value if not exists 'quarterly';

-- --------------------------------------------------------- charge generation
-- The billing period follows the cycle: one month, one quarter, or one year.
-- Anything unrecognised falls back to monthly, which is the shortest period and
-- so the one that under bills rather than over bills if a cycle is ever added
-- without this function being taught about it.
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

  if l.cycle::text = 'yearly' then
    start_on := date_trunc('year', period)::date;
    end_on := (date_trunc('year', period) + interval '1 year - 1 day')::date;
  elsif l.cycle::text = 'quarterly' then
    start_on := date_trunc('quarter', period)::date;
    end_on := (date_trunc('quarter', period) + interval '3 months - 1 day')::date;
  else
    start_on := date_trunc('month', period)::date;
    end_on := (date_trunc('month', period) + interval '1 month - 1 day')::date;
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
