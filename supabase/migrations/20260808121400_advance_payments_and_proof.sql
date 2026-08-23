-- Charta Home · rent paid ahead, and the paper that proves it
--
-- Two gaps in how money is recorded.
--
-- A tenant paying six months up front is ordinary here, and it did not work.
-- record_payment created the charge for the day of payment and then allocated
-- against whatever was open, so the surplus had nowhere to go: the payment was
-- recorded at its full amount, the tenant's next five months still read as
-- unpaid, and the difference sat in the payments table matching nothing. The
-- money was never lost, but the schedule lied.
--
-- And with no card processing, the proof of a payment is a photograph of a
-- deposit slip or an Orange Money confirmation. There was nowhere to keep it,
-- so the record said 1 200 000 GNF received and could not say how anyone knew.

alter table payments add column if not exists proof_path text;

comment on column payments.proof_path is
  'Storage object in the receipts bucket: the slip or screenshot behind this payment.';

-- ------------------------------------------------------ one period forward
-- The step depends on the lease, so it lives next to the charge generator
-- rather than being spelled out at each call site.
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
    when 'yearly'    then (from_period + interval '1 year')::date
    else                  (from_period + interval '1 month')::date
  end;
$$;

-- --------------------------------------------------------- record a payment
-- Dropped rather than replaced: adding parameters to the existing signature
-- would leave two overloads, and a later `grant execute on function
-- public.record_payment` would then be ambiguous.
drop function if exists public.record_payment(uuid, bigint, payment_method, date, text);

/**
 * Records money received and settles what it covers.
 *
 * periods_covered says how far forward the payment reaches. One is the normal
 * case and keeps the old behaviour exactly. Six creates the next five periods
 * before allocating, so a tenant who has paid the year reads as paid for the
 * year rather than as five months in arrears.
 *
 * Allocation is still oldest first, so arrears are cleared before anything is
 * put towards a period that has not arrived. An agency settling a debt and
 * paying ahead in one transfer does not have to split it themselves.
 */
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

  -- Every period this payment reaches has to exist before it can be settled.
  -- ensure_rent_charge is idempotent on (lease, period start), so a period
  -- already raised is left alone.
  period_cursor := paid_on_in;
  for i in 1..span loop
    -- A fixed term lease is not billed past its end.
    exit when l.ends_on is not null and period_cursor > l.ends_on;
    perform public.ensure_rent_charge(l.id, period_cursor);
    period_cursor := public.next_period_start(period_cursor, l.cycle);
  end loop;

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

  -- Mark fully settled charges so reminder jobs can skip them cheaply.
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
grant execute on function public.next_period_start to authenticated;
