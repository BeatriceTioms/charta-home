-- Charta Home · six month leases
--
-- Half yearly terms are common where a tenant pays around a harvest or a
-- school year, and there was no way to record one: it had to be entered as
-- two quarters or as a year that was not a year.

alter type lease_cycle add value if not exists 'semester';

-- ----------------------------------------------------------- one step on
create or replace function public.next_period_start(
  from_period date,
  cycle_in lease_cycle
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case cycle_in::text
    when 'daily'     then from_period + 1
    when 'quarterly' then (from_period + interval '3 months')::date
    when 'semester'  then (from_period + interval '6 months')::date
    when 'yearly'    then (from_period + interval '1 year')::date
    else                  (from_period + interval '1 month')::date
  end;
$$;

grant execute on function public.next_period_start to authenticated;

-- --------------------------------------------------------- charge generation
-- A semester is the first cycle whose period does not line up with a date_trunc
-- unit, so it is worked out from the year: January to June, or July to
-- December. That keeps two tenants on the same building billed for the same
-- two halves, rather than each on their own six month drift.
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
  elsif l.cycle::text = 'semester' then
    start_on := (date_trunc('year', period)
                 + make_interval(months => case when extract(month from period) <= 6 then 0 else 6 end))::date;
    end_on := (start_on + interval '6 months - 1 day')::date;
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

-- ------------------------------------------------- money with nowhere to go
-- Recording a payment for a tenant who is already straight allocated nothing:
-- the only period it could reach was the current one, and that was settled.
-- The payment was stored at its full amount and matched no month at all, so
-- the money was in the books and invisible on the schedule.
--
-- A tenant who is paid up and hands over more is paying ahead, so the periods
-- are raised as the money needs them rather than only the ones asked for. The
-- loop is bounded, and stops at the end of a fixed term lease.
create or replace function public.record_payment(
  target_lease uuid,
  payment_amount bigint,
  payment_method_in payment_method default 'cash',
  paid_on_in date default current_date,
  reference_in text default null,
  periods_covered integer default 1,
  proof_path_in text default null
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
  period_cursor date;
  i integer;
  span integer;
  next_charge uuid;
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

  -- A daily let paid a year ahead is 365 periods, so the ceiling is generous.
  -- It exists to stop a typo in a number field writing rows until it times out.
  span := least(greatest(coalesce(periods_covered, 1), 1), 400);

  insert into public.payments
    (agency_id, lease_id, amount, paid_on, method, reference, proof_path, recorded_by)
  values
    (l.agency_id, l.id, payment_amount, paid_on_in, payment_method_in, reference_in,
     nullif(btrim(coalesce(proof_path_in, '')), ''), auth.uid())
  returning id into new_payment;

  period_cursor := paid_on_in;
  for i in 1..span loop
    exit when l.ends_on is not null and period_cursor > l.ends_on;
    perform public.ensure_rent_charge(l.id, period_cursor);
    period_cursor := public.next_period_start(period_cursor, l.cycle);
  end loop;

  -- Oldest first, so arrears clear before anything goes towards a period that
  -- has not arrived.
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
      do update set amount = public.payment_allocations.amount + excluded.amount;

    remaining := remaining - take;
  end loop;

  -- Still money left, which means every period that exists is settled. Raise
  -- the next one and put it there, until the money runs out.
  if remaining > 0 then
    select max(period_start) into period_cursor
      from public.rent_charges where lease_id = l.id;
    period_cursor := coalesce(period_cursor, paid_on_in);

    for i in 1..400 loop
      exit when remaining <= 0;
      period_cursor := public.next_period_start(period_cursor, l.cycle);
      exit when l.ends_on is not null and period_cursor > l.ends_on;

      next_charge := public.ensure_rent_charge(l.id, period_cursor);
      exit when next_charge is null;

      select cs.balance into take
        from public.v_charge_status cs where cs.rent_charge_id = next_charge;
      if take is null or take <= 0 then
        continue;
      end if;
      take := least(remaining, take);

      insert into public.payment_allocations (payment_id, rent_charge_id, agency_id, amount)
      values (new_payment, next_charge, l.agency_id, take)
      on conflict (payment_id, rent_charge_id)
        do update set amount = public.payment_allocations.amount + excluded.amount;

      remaining := remaining - take;
    end loop;
  end if;

  update public.rent_charges rc
     set status = 'paid'
   where rc.lease_id = l.id
     and rc.status <> 'void'
     and exists (
       select 1 from public.v_charge_status cs
        where cs.rent_charge_id = rc.id and cs.balance <= 0
     );

  return new_payment;
end;
$$;

grant execute on function public.record_payment to authenticated;
