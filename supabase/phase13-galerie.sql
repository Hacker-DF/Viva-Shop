-- ==========================================================================
-- phase13-galerie.sql — Viva Shop — Plusieurs photos par produit, capture du paiement
-- À exécuter après viva-shop-mise-a-jour.sql.
-- ==========================================================================

-- Photos supplémentaires d'un produit (la photo principale reste dans products.main_image_url)
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images(product_id, position);

alter table public.product_images enable row level security;

drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read on public.product_images
  for select to anon, authenticated using (true);

drop policy if exists product_images_staff_write on public.product_images;
create policy product_images_staff_write on public.product_images
  for all to authenticated using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

-- Capture d'écran du paiement (privée)
alter table public.payment_declarations add column if not exists proof_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('justificatifs', 'justificatifs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Chaque client dépose et lit uniquement dans son propre dossier ; l'équipe financière lit tout
drop policy if exists justificatifs_insert_own on storage.objects;
create policy justificatifs_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'justificatifs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists justificatifs_select on storage.objects;
create policy justificatifs_select on storage.objects
  for select to authenticated
  using (bucket_id = 'justificatifs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.can_verify_payments()));
