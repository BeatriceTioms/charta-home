-- Charta Home · portfolio, people and contracts

-- ---------------------------------------------------------------- buildings

create table buildings (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references agencies (id) on delete cascade,
  name              text not null check (length(btrim(name)) > 0),
  address           text not null default '',
  city              text not null default '',
  -- Net yield needs a valuation. Without this the percentage is meaningless.
  acquisition_value bigint check (acquisition_value >= 0),
  market_value      bigint check (market_value >= 0),
  photo_path        text,
  interior_path     text,
  amenities         text[] not null default '{}',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index buildings_agency_idx on buildings (agency_id);

create trigger buildings_touch before update on buildings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- apartments

create table apartments (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies (id) on delete cascade,
  building_id uuid not null references buildings (id) on delete cascade,
  label       text not null check (length(btrim(label)) > 0),
  floor       text,
  rooms       smallint not null default 1 check (rooms >= 0),
  bathrooms   smallint not null default 1 check (bathrooms >= 0),
  sqm         numeric(8, 2) check (sqm > 0),
  base_rent   bigint not null default 0 check (base_rent >= 0),
  photo_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (building_id, label)
);

create index apartments_building_idx on apartments (building_id);
create index apartments_agency_idx on apartments (agency_id);

create trigger apartments_touch before update on apartments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- residents
-- "resident" rather than "tenant" so the word tenant always means an agency.

create table residents (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references agencies (id) on delete cascade,
  full_name     text not null check (length(btrim(full_name)) > 0),
  phone_e164    text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email         citext,
  id_document_path text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index residents_agency_idx on residents (agency_id);
create index residents_phone_idx on residents (phone_e164);

create trigger residents_touch before update on residents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- owners

create table owners (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references agencies (id) on delete cascade,
  full_name  text not null,
  email      citext,
  phone_e164 text,
  created_at timestamptz not null default now()
);

create table building_owners (
  building_id uuid not null references buildings (id) on delete cascade,
  owner_id    uuid not null references owners (id) on delete cascade,
  agency_id   uuid not null references agencies (id) on delete cascade,
  share       numeric(5, 2) not null default 100 check (share > 0 and share <= 100),
  primary key (building_id, owner_id)
);

create index owners_agency_idx on owners (agency_id);
create index building_owners_agency_idx on building_owners (agency_id);

-- ---------------------------------------------------------------- leases

create table leases (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  apartment_id uuid not null references apartments (id) on delete cascade,
  resident_id  uuid not null references residents (id) on delete restrict,
  cycle        lease_cycle not null default 'monthly',
  rent_amount  bigint not null check (rent_amount >= 0),
  deposit      bigint not null default 0 check (deposit >= 0),
  due_day      smallint not null default 1 check (due_day between 1 and 28),
  starts_on    date not null,
  ends_on      date,
  status       lease_status not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint leases_dates_ordered check (ends_on is null or ends_on >= starts_on)
);

create index leases_apartment_idx on leases (apartment_id);
create index leases_resident_idx on leases (resident_id);
create index leases_agency_idx on leases (agency_id);

-- One active lease per apartment at a time.
create unique index leases_one_active_per_apartment
  on leases (apartment_id)
  where status = 'active';

create trigger leases_touch before update on leases
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- policies

alter table buildings       enable row level security;
alter table apartments      enable row level security;
alter table residents       enable row level security;
alter table owners          enable row level security;
alter table building_owners enable row level security;
alter table leases          enable row level security;

-- Members read everything in their agency; owners, managers and accountants write.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['buildings', 'apartments', 'residents', 'owners', 'building_owners', 'leases']
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
      'create policy %1$s_delete on %1$s for delete using (public.has_role(agency_id, array[''owner'', ''manager'']::member_role[]))',
      tbl
    );
  end loop;
end $$;
