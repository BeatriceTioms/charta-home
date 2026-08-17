-- Charta Home · apartment photo galleries and technician performance

-- ------------------------------------------------------- apartment photos
-- An apartment has an ordered gallery rather than a single photo column, so
-- images can be added, reordered and removed independently.

create table apartment_photos (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  apartment_id uuid not null references apartments (id) on delete cascade,
  storage_path text not null,
  caption      text,
  position     smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index apartment_photos_apartment_idx on apartment_photos (apartment_id, position);
create index apartment_photos_agency_idx on apartment_photos (agency_id);

alter table apartment_photos enable row level security;

create policy apartment_photos_select on apartment_photos for select
  using (agency_id in (select public.current_agency_ids()));

create policy apartment_photos_write on apartment_photos for all
  using (public.has_role(agency_id, array['owner', 'manager', 'accountant']::public.member_role[]))
  with check (public.has_role(agency_id, array['owner', 'manager', 'accountant']::public.member_role[]));

-- Keep positions contiguous when a photo is removed.
create or replace function public.reorder_apartment_photos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.apartment_photos p
  set position = ordered.new_position
  from (
    select id, (row_number() over (order by position, created_at) - 1)::smallint as new_position
    from public.apartment_photos
    where apartment_id = old.apartment_id
  ) ordered
  where p.id = ordered.id and p.position is distinct from ordered.new_position;

  return null;
end;
$$;

create trigger apartment_photos_reorder after delete on apartment_photos
  for each row execute function public.reorder_apartment_photos();

-- --------------------------------------------------- technician performance
-- Powers the technicians tab: how many jobs, how much paid, how fast.

create view v_technician_performance
with (security_invoker = true)
as
select
  tech.id                as technician_id,
  tech.agency_id,
  tech.full_name,
  tech.trade,
  tech.phone_e164,
  tech.is_external,
  count(t.id)                                              as jobs_total,
  count(t.id) filter (where t.status = 'resolved')          as jobs_resolved,
  count(t.id) filter (where t.status <> 'resolved')         as jobs_open,
  coalesce(sum(t.cost) filter (where t.status = 'resolved'), 0)::bigint as total_paid,
  round(
    avg(
      extract(epoch from (t.resolved_at - t.opened_at)) / 86400
    ) filter (where t.status = 'resolved')::numeric,
    1
  )                       as avg_days_to_resolve,
  max(t.resolved_at)      as last_job_at
from technicians tech
left join tickets t on t.technician_id = tech.id
group by tech.id;

-- ------------------------------------------------------------ reassignment
-- Reassigning is not a plain update: it should record who took over and reset
-- the ticket to assigned so the new technician sees it as fresh work.

create or replace function public.assign_technician(
  target_ticket uuid,
  target_technician uuid,
  estimated_cost bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tk record;
  tech record;
begin
  select * into tk from public.tickets where id = target_ticket;
  if not found then
    raise exception 'ticket % not found', target_ticket;
  end if;
  if not public.is_member(tk.agency_id) then
    raise exception 'not a member of this agency';
  end if;

  select * into tech from public.technicians where id = target_technician;
  if not found or tech.agency_id <> tk.agency_id then
    raise exception 'technician % is not in this agency', target_technician;
  end if;

  update public.tickets
  set technician_id = target_technician,
      status = case when status = 'resolved' then status else 'assigned' end,
      cost = coalesce(estimated_cost, cost)
  where id = target_ticket;

  insert into public.ticket_messages (agency_id, ticket_id, direction, body)
  values (
    tk.agency_id,
    target_ticket,
    'outbound',
    case
      when tk.technician_id is null then 'Assigné à ' || tech.full_name
      else 'Réassigné à ' || tech.full_name
    end
  );
end;
$$;

grant execute on function public.assign_technician to authenticated;
