-- Charta Home · private storage buckets
-- Paths always begin with the agency id so a policy can check membership:
--   building-photos/<agency_id>/<building_id>/<file>

insert into storage.buckets (id, name, public)
values
  ('building-photos', 'building-photos', false),
  ('apartment-photos', 'apartment-photos', false),
  ('receipts', 'receipts', false),
  ('documents', 'documents', false)
on conflict (id) do nothing;

-- Objects are readable and writable only by members of the agency named in the
-- first path segment.
create policy "charta members read objects"
on storage.objects for select
to authenticated
using (
  bucket_id in ('building-photos', 'apartment-photos', 'receipts', 'documents')
  and public.is_member(((storage.foldername(name))[1])::uuid)
);

create policy "charta members upload objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('building-photos', 'apartment-photos', 'receipts', 'documents')
  and public.is_member(((storage.foldername(name))[1])::uuid)
);

create policy "charta members update objects"
on storage.objects for update
to authenticated
using (
  bucket_id in ('building-photos', 'apartment-photos', 'receipts', 'documents')
  and public.is_member(((storage.foldername(name))[1])::uuid)
);

create policy "charta members delete objects"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('building-photos', 'apartment-photos', 'receipts', 'documents')
  and public.is_member(((storage.foldername(name))[1])::uuid)
);
