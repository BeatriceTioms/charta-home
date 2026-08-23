-- Charta Home · remembering where a WhatsApp conversation got to
--
-- The webhook could do exactly one thing: turn a single message into a ticket.
-- That is not how anybody reports a problem. A real report arrives as
--
--   "bonjour"
--   "le robinet de la salle de bain fuit"
--   [photo]
--
-- which opened three tickets, one of them called "bonjour", and lost the
-- photograph. And a tenant on two leases could not be placed at all, because
-- there was no way to ask which flat and no way to remember having asked.
--
-- So the conversation carries a state. It is deliberately small: a tenant
-- should not be walked through a menu to say a tap is leaking.

alter table wa_conversations
  add column if not exists state text not null default 'idle'
    check (state in ('idle', 'awaiting_apartment')),
  -- The report a tenant already typed, held while we ask which flat it is
  -- about, so they never have to write it twice.
  add column if not exists pending_report text,
  -- Further messages join this ticket instead of opening another.
  add column if not exists active_ticket_id uuid references tickets (id) on delete set null,
  add column if not exists state_changed_at timestamptz not null default now();

comment on column wa_conversations.state is
  'idle, or awaiting_apartment when the tenant has been asked which unit.';
comment on column wa_conversations.active_ticket_id is
  'Recent open ticket. Follow up messages attach here rather than duplicating.';

-- ------------------------------------------------------- follow up window
-- How long a message is treated as part of the report before it rather than
-- as a new one. A photograph sent a minute later is plainly the same subject;
-- a message the following week is plainly not.
create or replace function public.wa_followup_window()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '6 hours' $$;

/**
 * Where an inbound message should go.
 *
 * Returns the conversation row with a decision attached, so the webhook makes
 * one round trip instead of four and cannot drift out of step with itself.
 *
 * The decision is one of:
 *   attach  - add to active_ticket_id, the tenant is still describing
 *   ask     - more than one lease, and we do not know which flat
 *   answer  - they were asked, this message names the flat
 *   open    - a new report, one lease, go ahead
 *   unknown - the number is not a tenant of this agency
 */
create or replace function public.wa_route_inbound(
  from_phone text,
  body text
)
-- The output names deliberately avoid agency_id, resident_id and
-- pending_report. Those are columns on wa_conversations, and an OUT parameter
-- sharing a name with a column makes every mention of it inside the body
-- ambiguous, including the one in `on conflict (agency_id, phone_e164)`.
returns table (
  conversation_id uuid,
  agency uuid,
  resident uuid,
  resident_name text,
  decision text,
  ticket_id uuid,
  report text,
  lease_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  conv record;
  leases integer;
begin
  -- A phone number is the identity. It is the one thing a tenant cannot
  -- forget, mistype under stress, or need to be told twice, which is why
  -- nothing here asks for a reference number.
  select res.id, res.agency_id, res.full_name
    into r
    from public.residents res
   where res.phone_e164 = from_phone
   limit 1;

  if not found then
    return query select null::uuid, null::uuid, null::uuid, null::text,
                        'unknown'::text, null::uuid, null::text, 0;
    return;
  end if;

  select count(*)::integer into leases
    from public.leases l
   where l.resident_id = r.id and l.status = 'active';

  insert into public.wa_conversations (agency_id, phone_e164, resident_id, last_inbound_at)
  values (r.agency_id, from_phone, r.id, now())
  on conflict (agency_id, phone_e164) do update
    set last_inbound_at = now(), resident_id = excluded.resident_id
  returning * into conv;

  -- Asked which flat, and this is the reply.
  if conv.state = 'awaiting_apartment' then
    return query select conv.id, r.agency_id, r.id, r.full_name,
                        'answer'::text, null::uuid, conv.pending_report, leases;
    return;
  end if;

  -- Still talking about something opened a moment ago.
  if conv.active_ticket_id is not null
     and conv.state_changed_at > now() - public.wa_followup_window()
     and exists (
       select 1 from public.tickets t
        where t.id = conv.active_ticket_id and t.status <> 'resolved'
     )
  then
    return query select conv.id, r.agency_id, r.id, r.full_name,
                        'attach'::text, conv.active_ticket_id, null::text, leases;
    return;
  end if;

  if leases = 0 then
    return query select conv.id, r.agency_id, r.id, r.full_name,
                        'unknown'::text, null::uuid, null::text, 0;
  elsif leases > 1 then
    return query select conv.id, r.agency_id, r.id, r.full_name,
                        'ask'::text, null::uuid, body, leases;
  else
    return query select conv.id, r.agency_id, r.id, r.full_name,
                        'open'::text, null::uuid, body, leases;
  end if;
end;
$$;

revoke all on function public.wa_route_inbound from public;

/** Records what the webhook decided, so the next message lands correctly. */
create or replace function public.wa_set_state(
  conversation uuid,
  new_state text,
  report text default null,
  ticket uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.wa_conversations
     set state = new_state,
         pending_report = report,
         active_ticket_id = coalesce(ticket, active_ticket_id),
         state_changed_at = now()
   where id = conversation;
$$;

revoke all on function public.wa_set_state from public;
