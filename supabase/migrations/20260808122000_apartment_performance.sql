-- Charta Home · what a flat actually returned
--
-- The apartment page showed a "net yield" that was the building's figure
-- repeated on every unit in it, so two flats with very different histories
-- read identically. And the dashboard invented two of its four tiles outright:
-- service charges were rent times 0.08, and maintenance was the building's
-- expenses divided by eight. Both were plausible looking numbers that nothing
-- in the database supported, on a screen an agency uses to decide things.
--
-- This is the per unit equivalent of v_building_performance: money actually
-- received against money actually spent on that unit, for the current year.
-- Expenses recorded against the building rather than a flat are deliberately
-- not spread across its flats, because apportioning a roof repair by guesswork
-- would put a number on the screen that nobody could check.

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
  -- What is left of the rent after what the flat cost to keep. Null rather
  -- than zero when nothing has been collected: a unit that has taken no money
  -- has no margin, and showing 0% would read as one that broke even.
  case
    when coalesce(collected.total, 0) > 0
      then round(
        ((coalesce(collected.total, 0) - coalesce(spent.total, 0))::numeric
          / collected.total) * 100,
        1
      )
    else null
  end                                          as net_margin_pct
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
) spent on true;

comment on view v_apartment_performance is
  'Per unit money in and money out for the current year. Building level expenses are not apportioned.';
