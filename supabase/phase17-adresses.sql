-- ==========================================================================
-- phase17-adresses.sql — Viva Shop — Adresses de livraison du client
-- À exécuter après viva-shop-devis-photo.sql.
-- Chaque client ne voit que ses propres adresses.
-- ==========================================================================

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 2 and 40),
  address text not null check (char_length(address) between 5 and 300),
  city text check (city is null or char_length(city) <= 80),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Une seule adresse par défaut
create unique index if not exists addresses_one_default_idx
  on public.addresses(user_id) where is_default;

alter table public.addresses enable row level security;

drop policy if exists addresses_own on public.addresses;
create policy addresses_own on public.addresses
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_account_active());
