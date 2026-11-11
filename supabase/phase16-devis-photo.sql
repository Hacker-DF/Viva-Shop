-- ==========================================================================
-- phase16-devis-photo.sql — Viva Shop — Acceptation du devis et photo de profil
-- À exécuter après viva-shop-qr.sql.
-- ==========================================================================

-- Le client accepte ou refuse le devis reçu (et seulement celui-là)
drop policy if exists special_orders_client_decision on public.special_orders;
create policy special_orders_client_decision on public.special_orders
  for update to authenticated
  using (user_id = auth.uid() and status = 'devis_envoye')
  with check (user_id = auth.uid() and status in ('acceptee', 'refusee'));

-- Photo de profil
alter table public.profiles add column if not exists avatar_url text;
grant update (avatar_url) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
