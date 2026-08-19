-- Charta Home · guards that belong in the database
--
-- Two of these existed only in application code, which means they held for the
-- dashboard and not for anyone calling PostgREST directly with their own token.
-- A rule that protects payment history should not depend on which client asked.

-- ------------------------------------------- deleting an occupied apartment
-- apartments cascades to leases, which cascades to rent_charges and payments.
-- Deleting a unit somebody still lives in therefore erases the money it has
-- collected. The server action refused this already; now the database does.

create or replace function public.block_delete_occupied_apartment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.leases
    where apartment_id = old.id and status = 'active'
  ) then
    raise exception 'apartment % still has an active lease', old.id
      using errcode = 'restrict_violation',
            hint = 'End the lease before deleting the unit.';
  end if;
  return old;
end;
$$;

drop trigger if exists apartments_block_occupied_delete on apartments;
create trigger apartments_block_occupied_delete
  before delete on apartments
  for each row execute function public.block_delete_occupied_apartment();

-- ------------------------------------------------------------ rate limiting
-- The WhatsApp webhook verifies Meta's signature but nothing bounded how often
-- it could be called. Serverless instances share no memory, so the counter
-- lives in Postgres, which every instance already talks to.

create table if not exists rate_limits (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);

alter table rate_limits enable row level security;
-- No policies: only the service role, which bypasses RLS, ever touches this.

comment on table rate_limits is
  'Fixed window counters for unauthenticated endpoints. Service role only.';

/**
 * Records one hit and reports whether it is allowed.
 *
 * A fixed window rather than a sliding one: it is one row and one statement,
 * and for shedding a flood the difference does not matter. The upsert makes
 * the read and the increment a single atomic step, so two instances arriving
 * together cannot both see the count below the limit.
 */
create or replace function public.take_rate_limit(
  bucket_key text,
  max_hits integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_hits integer;
begin
  insert into public.rate_limits (bucket, window_start, hits)
  values (bucket_key, now(), 1)
  on conflict (bucket) do update
    set hits = case
          when public.rate_limits.window_start < now() - make_interval(secs => window_seconds)
            then 1
          else public.rate_limits.hits + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - make_interval(secs => window_seconds)
            then now()
          else public.rate_limits.window_start
        end
  returning hits into current_hits;

  return current_hits <= max_hits;
end;
$$;

revoke all on function public.take_rate_limit from public;
