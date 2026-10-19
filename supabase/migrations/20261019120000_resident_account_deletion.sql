-- ---------------------------------------------------------------------------
-- Account deletion from the resident app.
--
-- The App Store and Google Play require an app that creates accounts to let
-- people delete them from inside the app. DELETE /api/mobile/account calls
-- forget_resident_user, then deletes the auth user. What the agency must keep
-- (payments, leases, paid stays, tickets) stays, unlinked from the account.
-- ---------------------------------------------------------------------------

-- A gateway record is part of the agency's accounting trail: keep it when the
-- payer's account goes, instead of cascading it away.
alter table resident_payments alter column user_id drop not null;
alter table resident_payments drop constraint if exists resident_payments_user_id_fkey;
alter table resident_payments
  add constraint resident_payments_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

/**
 * Loosens what would otherwise block or outlive the account:
 * - an unpaid hold ends now, so the nights free up straight away;
 * - repair photos stay with the agency's ticket, but Supabase refuses to
 *   delete a user who still owns storage objects, so ownership is cleared.
 * Service role only: the route has already checked who is asking.
 */
create or replace function public.forget_resident_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update stays
     set status = 'cancelled', notes = coalesce(notes || ' · ', '') || 'guest deleted account'
   where guest_user_id = target and paid = 0 and hold_expires_at is not null and status <> 'cancelled';

  update storage.objects set owner = null where owner = target;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'storage' and table_name = 'objects' and column_name = 'owner_id'
  ) then
    execute 'update storage.objects set owner_id = null where owner_id = $1' using target::text;
  end if;
end;
$$;

revoke all on function public.forget_resident_user(uuid) from public, anon, authenticated;
grant execute on function public.forget_resident_user(uuid) to service_role;
