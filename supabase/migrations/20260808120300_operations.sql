-- Charta Home · maintenance, schedule, billing, audit

create table technicians (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies (id) on delete cascade,
  full_name   text not null,
  trade       text,
  phone_e164  text,
  is_external boolean not null default true,
  created_at  timestamptz not null default now()
);

create index technicians_agency_idx on technicians (agency_id);

create table tickets (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references agencies (id) on delete cascade,
  building_id   uuid not null references buildings (id) on delete cascade,
  apartment_id  uuid references apartments (id) on delete set null,
  resident_id   uuid references residents (id) on delete set null,
  technician_id uuid references technicians (id) on delete set null,
  title         text not null check (length(btrim(title)) > 0),
  description   text,
  status        ticket_status not null default 'new',
  priority      ticket_priority not null default 'normal',
  reported_via  report_channel not null default 'whatsapp',
  cost          bigint check (cost >= 0),
  opened_at     timestamptz not null default now(),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint tickets_resolved_has_time check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved')
  )
);

create index tickets_building_idx on tickets (building_id);
create index tickets_agency_opened_idx on tickets (agency_id, opened_at desc);
create index tickets_open_idx on tickets (agency_id) where status <> 'resolved';

create trigger tickets_touch before update on tickets
  for each row execute function public.touch_updated_at();

alter table expenses
  add constraint expenses_ticket_fk
  foreign key (ticket_id) references tickets (id) on delete set null;

create table ticket_messages (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null references agencies (id) on delete cascade,
  ticket_id           uuid not null references tickets (id) on delete cascade,
  direction           text not null check (direction in ('inbound', 'outbound')),
  body                text,
  media_path          text,
  provider_message_id text,
  created_at          timestamptz not null default now()
);

create unique index ticket_messages_provider_uniq
  on ticket_messages (provider_message_id)
  where provider_message_id is not null;

create index ticket_messages_ticket_idx on ticket_messages (ticket_id, created_at);

-- ---------------------------------------------------------------- schedule

create table events (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  building_id  uuid not null references buildings (id) on delete cascade,
  apartment_id uuid references apartments (id) on delete set null,
  kind         event_kind not null default 'viewing',
  title        text not null,
  detail       text,
  starts_at    timestamptz not null,
  assignee     text,
  created_at   timestamptz not null default now()
);

create index events_agency_start_idx on events (agency_id, starts_at);
create index events_building_idx on events (building_id, starts_at);

-- --------------------------------------------------- reminders over WhatsApp

create table reminder_rules (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references agencies (id) on delete cascade,
  offset_days   smallint not null,           -- negative is before the due date
  channel       report_channel not null default 'whatsapp',
  template_name text,                        -- Meta requires an approved template
  escalation_step smallint not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (agency_id, offset_days, channel)
);

create table reminder_events (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null references agencies (id) on delete cascade,
  rent_charge_id      uuid not null references rent_charges (id) on delete cascade,
  rule_id             uuid references reminder_rules (id) on delete set null,
  channel             report_channel not null,
  sent_at             timestamptz not null default now(),
  provider_message_id text,
  status              text not null default 'queued',
  unique (rent_charge_id, rule_id)
);

create index reminder_events_agency_idx on reminder_events (agency_id, sent_at desc);

create table wa_conversations (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references agencies (id) on delete cascade,
  phone_e164      text not null,
  resident_id     uuid references residents (id) on delete set null,
  last_inbound_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (agency_id, phone_e164)
);

-- ---------------------------------------------------------------- billing

create table plan_limits (
  plan           plan_tier primary key,
  max_buildings  integer,
  max_apartments integer,
  max_members    integer,
  price_usd      integer not null,
  features       jsonb not null default '{}'
);

insert into plan_limits (plan, max_buildings, max_apartments, max_members, price_usd, features) values
  ('starter', 1, 20, 1, 29,
   '{"whatsapp_maintenance": false, "owner_reports": false, "reminders": ["email"]}'),
  ('growth', 5, 150, 5, 79,
   '{"whatsapp_maintenance": true, "owner_reports": true, "reminders": ["whatsapp","sms","email"]}'),
  ('agency', null, null, null, 199,
   '{"whatsapp_maintenance": true, "owner_reports": true, "priority_support": true, "reminders": ["whatsapp","sms","email"]}');

create table subscriptions (
  agency_id          uuid primary key references agencies (id) on delete cascade,
  plan               plan_tier not null default 'growth',
  status             subscription_status not null default 'trialing',
  trial_ends_at      timestamptz not null default (now() + interval '30 days'),
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger subscriptions_touch before update on subscriptions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- audit log

create table audit_log (
  id         bigserial primary key,
  agency_id  uuid,
  actor      uuid,
  table_name text not null,
  row_id     uuid,
  action     text not null,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_agency_idx on audit_log (agency_id, created_at desc);

create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_agency uuid;
  row_id uuid;
begin
  if (tg_op = 'DELETE') then
    row_agency := old.agency_id;
    row_id := old.id;
  else
    row_agency := new.agency_id;
    row_id := new.id;
  end if;

  insert into public.audit_log (agency_id, actor, table_name, row_id, action, before, after)
  values (
    row_agency,
    auth.uid(),
    tg_table_name,
    row_id,
    tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  return null;
end;
$$;

create trigger payments_audit after insert or update or delete on payments
  for each row execute function public.write_audit();
create trigger rent_charges_audit after insert or update or delete on rent_charges
  for each row execute function public.write_audit();
create trigger leases_audit after insert or update or delete on leases
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------- policies

alter table technicians       enable row level security;
alter table tickets           enable row level security;
alter table ticket_messages   enable row level security;
alter table events            enable row level security;
alter table reminder_rules    enable row level security;
alter table reminder_events   enable row level security;
alter table wa_conversations  enable row level security;
alter table subscriptions     enable row level security;
alter table audit_log         enable row level security;
alter table plan_limits       enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'technicians', 'tickets', 'ticket_messages', 'events',
    'reminder_rules', 'reminder_events', 'wa_conversations'
  ]
  loop
    execute format(
      'create policy %1$s_select on %1$s for select using (agency_id in (select public.current_agency_ids()))',
      tbl
    );
    execute format(
      'create policy %1$s_write on %1$s for all using (public.has_role(agency_id, array[''owner'', ''manager'', ''accountant'', ''caretaker'']::member_role[])) with check (public.has_role(agency_id, array[''owner'', ''manager'', ''accountant'', ''caretaker'']::member_role[]))',
      tbl
    );
  end loop;
end $$;

create policy subscriptions_select on subscriptions for select
  using (agency_id in (select public.current_agency_ids()));

create policy subscriptions_update on subscriptions for update
  using (public.has_role(agency_id, array['owner']::member_role[]))
  with check (public.has_role(agency_id, array['owner']::member_role[]));

-- Read only, and only your own agency's trail.
create policy audit_log_select on audit_log for select
  using (agency_id in (select public.current_agency_ids()));

-- Plan limits are public reference data.
create policy plan_limits_select on plan_limits for select using (true);
