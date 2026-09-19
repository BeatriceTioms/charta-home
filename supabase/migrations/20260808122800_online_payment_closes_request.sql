-- Charta Home · a checkout that fails closes the request it opened
--
-- Opening a checkout records a plan request, the same row the manual path
-- records, so the desk sees one kind of thing. A checkout that failed or was
-- abandoned left that request pending, which read as an agency waiting to
-- be sent a code. It is cancelled now, because nothing is waiting: the
-- agency can press Pay now again whenever it likes.

create or replace function public.settle_subscription_payment(
  payment_id_in uuid,
  final_status text,
  raw_in jsonb default null
)
returns table (outcome text, new_plan text, active_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  base timestamptz;
  span interval;
  until timestamptz;
begin
  if final_status not in ('paid', 'failed', 'cancelled') then
    raise exception 'unknown final status %', final_status;
  end if;

  select * into p from public.subscription_payments where id = payment_id_in for update;
  if not found then
    raise exception 'unknown payment';
  end if;

  if p.status <> 'initiated' then
    select s.current_period_end into until from public.subscriptions s where s.agency_id = p.agency_id;
    return query select p.status::text, p.plan, until;
    return;
  end if;

  update public.subscription_payments
     set status = final_status, settled_at = now(), raw = coalesce(raw_in, raw)
   where id = p.id;

  if final_status <> 'paid' then
    if p.request_id is not null then
      update public.plan_requests set status = 'cancelled'
       where id = p.request_id and status = 'pending';
    end if;
    return query select final_status, p.plan, null::timestamptz;
    return;
  end if;

  span := case p.cycle when 'annual' then interval '1 year' else interval '1 month' end;

  select greatest(coalesce(s.current_period_end, now()), now()) into base
  from public.subscriptions s where s.agency_id = p.agency_id;
  until := coalesce(base, now()) + span;

  insert into public.subscriptions (agency_id, plan, status, current_period_end)
  values (p.agency_id, p.plan, 'active', until)
  on conflict (agency_id) do update
    set plan = excluded.plan,
        status = 'active',
        current_period_end = excluded.current_period_end;

  if p.request_id is not null then
    update public.plan_requests set status = 'paid' where id = p.request_id;
  end if;

  return query select 'paid'::text, p.plan, until;
end;
$$;

revoke all on function public.settle_subscription_payment from public;
revoke all on function public.settle_subscription_payment from authenticated;
