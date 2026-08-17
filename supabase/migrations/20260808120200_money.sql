-- Charta Home · money
-- All amounts are integers in the smallest unit of the agency currency.
-- The Guinean franc has no subunit, so a GNF amount is whole francs.
-- rent_charges is the ledger. Payments allocate against charges, and status is
-- derived rather than stored so it can never drift.

create table rent_charges (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references agencies (id) on delete cascade,
  lease_id      uuid not null references leases (id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  amount        bigint not null check (amount >= 0),
  due_on        date not null,
  status        charge_status not null default 'open',
  created_at    timestamptz not null default now(),
  constraint rent_charges_period_ordered check (period_end >= period_start),
  unique (lease_id, period_start)
);

create index rent_charges_lease_idx on rent_charges (lease_id);
create index rent_charges_agency_due_idx on rent_charges (agency_id, due_on);
create index rent_charges_open_idx on rent_charges (agency_id, due_on) where status = 'open';

create table payments (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  lease_id     uuid not null references leases (id) on delete cascade,
  amount       bigint not null check (amount > 0),
  paid_on      date not null default current_date,
  method       payment_method not null default 'cash',
  reference    text,
  recorded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index payments_lease_idx on payments (lease_id);
create index payments_agency_paid_idx on payments (agency_id, paid_on);

create table payment_allocations (
  payment_id     uuid not null references payments (id) on delete cascade,
  rent_charge_id uuid not null references rent_charges (id) on delete cascade,
  agency_id      uuid not null references agencies (id) on delete cascade,
  amount         bigint not null check (amount > 0),
  primary key (payment_id, rent_charge_id)
);

create index payment_allocations_charge_idx on payment_allocations (rent_charge_id);

create table expenses (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  building_id  uuid not null references buildings (id) on delete cascade,
  apartment_id uuid references apartments (id) on delete set null,
  ticket_id    uuid,
  category     text not null default 'maintenance',
  amount       bigint not null check (amount >= 0),
  incurred_on  date not null default current_date,
  description  text,
  receipt_path text,
  created_at   timestamptz not null default now()
);

create index expenses_building_idx on expenses (building_id);
create index expenses_agency_date_idx on expenses (agency_id, incurred_on);

-- ------------------------------------------------------------ derived views

-- How much of each charge has been settled, and whether it is late today.
create view v_charge_status
with (security_invoker = true)
as
select
  c.id            as rent_charge_id,
  c.agency_id,
  c.lease_id,
  c.period_start,
  c.period_end,
  c.due_on,
  c.amount,
  coalesce(sum(a.amount), 0)::bigint                 as paid_amount,
  (c.amount - coalesce(sum(a.amount), 0))::bigint    as balance,
  case
    when c.status = 'void' then 'void'
    when coalesce(sum(a.amount), 0) >= c.amount then 'paid'
    when c.due_on < current_date then 'overdue'
    else 'pending'
  end                                                as state
from rent_charges c
left join payment_allocations a on a.rent_charge_id = c.id
group by c.id;

-- One row per apartment with its live lease and current rent state.
create view v_apartment_state
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
  end as rent_state
from apartments ap
left join leases l
  on l.apartment_id = ap.id and l.status = 'active'
left join residents r
  on r.id = l.resident_id;

-- Per building performance, the numbers behind the ROI cards.
create view v_building_performance
with (security_invoker = true)
as
select
  b.id                            as building_id,
  b.agency_id,
  b.name,
  count(ap.id)                    as apartment_count,
  count(ap.id) filter (where st.is_occupied) as occupied_count,
  coalesce(sum(ap.sqm), 0)        as total_sqm,
  coalesce(
    (
      select sum(p.amount)
      from payments p
      join leases l2 on l2.id = p.lease_id
      join apartments ap2 on ap2.id = l2.apartment_id
      where ap2.building_id = b.id
        and p.paid_on >= date_trunc('year', current_date)
    ),
    0
  )::bigint                        as income_ytd,
  coalesce(
    (
      select sum(e.amount)
      from expenses e
      where e.building_id = b.id
        and e.incurred_on >= date_trunc('year', current_date)
    ),
    0
  )::bigint                        as expenses_ytd,
  case
    when coalesce(b.market_value, b.acquisition_value, 0) > 0 then
      round(
        (
          coalesce(
            (
              select sum(p.amount) from payments p
              join leases l3 on l3.id = p.lease_id
              join apartments ap3 on ap3.id = l3.apartment_id
              where ap3.building_id = b.id
                and p.paid_on >= date_trunc('year', current_date)
            ), 0
          )
          - coalesce(
            (
              select sum(e.amount) from expenses e
              where e.building_id = b.id
                and e.incurred_on >= date_trunc('year', current_date)
            ), 0
          )
        )::numeric * 100 / coalesce(b.market_value, b.acquisition_value),
        2
      )
    else null
  end                              as net_yield_pct
from buildings b
left join apartments ap on ap.building_id = b.id
left join v_apartment_state st on st.apartment_id = ap.id
group by b.id;

-- ---------------------------------------------------------------- policies

alter table rent_charges         enable row level security;
alter table payments             enable row level security;
alter table payment_allocations  enable row level security;
alter table expenses             enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['rent_charges', 'payments', 'payment_allocations', 'expenses']
  loop
    execute format(
      'create policy %1$s_select on %1$s for select using (agency_id in (select public.current_agency_ids()))',
      tbl
    );
    execute format(
      'create policy %1$s_insert on %1$s for insert with check (public.has_role(agency_id, array[''owner'', ''manager'', ''accountant'']::member_role[]))',
      tbl
    );
    execute format(
      'create policy %1$s_update on %1$s for update using (public.has_role(agency_id, array[''owner'', ''manager'', ''accountant'']::member_role[])) with check (public.has_role(agency_id, array[''owner'', ''manager'', ''accountant'']::member_role[]))',
      tbl
    );
    execute format(
      'create policy %1$s_delete on %1$s for delete using (public.has_role(agency_id, array[''owner'']::member_role[]))',
      tbl
    );
  end loop;
end $$;
