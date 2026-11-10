-- ==========================================================================
-- phase11b-photo-demande.sql — Viva Shop — Photo jointe à une demande spéciale
-- À exécuter après phase11-demandes.sql.
-- Le client peut téléverser une photo, uniquement dans le dossier « demandes ».
-- ==========================================================================

alter table public.special_orders add column if not exists image_url text;

-- Téléversement par le client, limité au dossier « demandes » du bucket produits
drop policy if exists produits_client_demande_insert on storage.objects;
create policy produits_client_demande_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produits' and (storage.foldername(name))[1] = 'demandes');
