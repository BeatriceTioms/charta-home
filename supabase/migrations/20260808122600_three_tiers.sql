-- Charta Home · three tiers, as the sheet says
--
-- The first reading of the pricing sheet produced five tiers, two of them
-- invented to resolve what looked like overlaps. The sheet has three: Starter
-- to thirty apartments, a middle tier to a hundred, Business to two hundred
-- and fifty. The middle one is Professional in Guinea and Growth in Cameroon,
-- one code with two names, which the interface handles.
--
-- Anything that pointed at the two invented tiers is moved first, because
-- the tables reference the catalogue: Pro covered 51 to 100, which is now the
-- middle tier; Enterprise sat above Business, which is now the top.

update subscriptions  set plan = 'growth'   where plan = 'pro';
update subscriptions  set plan = 'business' where plan = 'enterprise';
update plan_requests  set plan = 'growth'   where plan = 'pro';
update plan_requests  set plan = 'business' where plan = 'enterprise';
update plan_codes     set plan = 'growth'   where plan = 'pro';
update plan_codes     set plan = 'business' where plan = 'enterprise';

delete from plan_prices where plan in ('pro', 'enterprise');
delete from plans       where code in ('pro', 'enterprise');

update plans set rank = 2, min_apartments = 31,  max_apartments = 100 where code = 'growth';
update plans set rank = 3, min_apartments = 101, max_apartments = 250 where code = 'business';

comment on table plans is
  'The three tiers. A tier is a band of managed apartments; nothing else is restricted.';

-- ----------------------------------------------- what a flat has been
-- The unit page had a strip of weekdays pinned to one week in August 2026
-- and nothing behind it. What an agency wants to know about a flat is what
-- it has been: how many tenants it has had, what it has brought in over its
-- life, when it was last paid, how long it has stood empty. Appended to the
-- performance view, which is the one change `create or replace` allows.
create or replace view v_apartment_performance
with (security_invoker = true)
as
select
  ap.id                                        as apartment_id,
  ap.agency_id,
  ap.building_id,
  coalesce(collected.total, 0)::bigint         as collected_ytd,
  coalesce(spent.total, 0)::bigint             as expenses_ytd,
  (coalesce(collected.total, 0) - coalesce(spent.total, 0))::bigint as net_ytd,
  case
    when coalesce(collected.total, 0) > 0
      then round(
        ((coalesce(collected.total, 0) - coalesce(spent.total, 0))::numeric
          / collected.total) * 100,
        1
      )
    else null
  end                                          as net_margin_pct,
  coalesce(life.tenants, 0)::integer           as tenants_ever,
  life.first_lease_on                          as first_lease_on,
  life.last_lease_ended_on                     as last_lease_ended_on,
  coalesce(life.collected, 0)::bigint          as collected_lifetime,
  coalesce(life.payments, 0)::integer          as payments_count,
  life.last_payment_on                         as last_payment_on,
  coalesce(spent_life.total, 0)::bigint        as expenses_lifetime,
  coalesce(tk.total, 0)::integer               as tickets_total,
  coalesce(tk.open, 0)::integer                as tickets_open
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
) tk on true;

comment on view v_apartment_performance is
  'Per unit money in and money out for the current year, and what the unit has been over its life. Building level expenses are not apportioned.';
