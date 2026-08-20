-- Charta Home · daily leases
--
-- Short stay letting is ordinary business for an agency in Conakry: a
-- furnished flat taken for a week, a room let by the night. Recording that as
-- a monthly lease meant one charge covering a stay that had already ended.
--
-- A daily charge covers exactly the day it is raised. The due day, which for a
-- monthly lease says which day of the month rent falls on, has nothing to
-- describe here, so a daily charge is due on the day itself.

alter type lease_cycle add value if not exists 'daily';

-- --------------------------------------------------------- charge generation
-- One day, one month, one quarter, or one year. Anything unrecognised still
-- falls back to monthly, which under bills rather than over bills if a cycle
-- is ever added without this function being taught about it.
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
  due date;
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
  elsif l.cycle::text = 'daily' then
    start_on := period;
    end_on := period;
  else
    start_on := date_trunc('month', period)::date;
    end_on := (date_trunc('month', period) + interval '1 month - 1 day')::date;
  end if;

  -- A day long charge is due that day. Offsetting by due_day would push it
  -- past the end of the period it bills for.
  if l.cycle::text = 'daily' then
    due := start_on;
  else
    due := (start_on + (l.due_day - 1) * interval '1 day')::date;
  end if;

  insert into public.rent_charges (agency_id, lease_id, period_start, period_end, amount, due_on)
  values (l.agency_id, l.id, start_on, end_on, l.rent_amount, due)
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
