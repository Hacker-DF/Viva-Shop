-- ==========================================================================
-- phase6-photos.sql — Viva Shop — Photos des produits (stockage Supabase)
-- À exécuter une seule fois. Lecture publique ; écriture réservée au catalogue.
-- ==========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produits', 'produits', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists produits_public_read on storage.objects;
create policy produits_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'produits');

drop policy if exists produits_staff_insert on storage.objects;
create policy produits_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produits' and public.can_manage_catalogue());

drop policy if exists produits_staff_delete on storage.objects;
create policy produits_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'produits' and public.can_manage_catalogue());
