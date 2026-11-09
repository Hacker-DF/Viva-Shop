-- ==========================================================================
-- phase4-reservations.sql — Viva Shop — Phase 4 : tarifs dégressifs et réservations
-- À exécuter après phase3b-admin.sql. Une réservation n'est PAS un paiement.
-- ==========================================================================

-- ---------- Tarifs dégressifs (par tranche de quantité) ----------
create table if not exists public.price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  min_qty int not null check (min_qty >= 1),
  max_qty int check (max_qty is null or max_qty >= min_qty),   -- null = « et plus »
  unit_price_ht int not null check (unit_price_ht >= 0),
  unique (product_id, min_qty)
);

-- ---------- Réservations ----------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant text check (char_length(variant) <= 60),
  capacity text check (char_length(capacity) <= 60),
  quantity int not null check (quantity between 1 and 10000),
  notes text check (char_length(notes) <= 500),
  status text not null default 'enregistree' check (status in ('enregistree', 'annulee')),
  created_at timestamptz not null default now()
);
create index if not exists reservations_user_idx on public.reservations(user_id, created_at desc);

alter table public.price_tiers enable row level security;
alter table public.reservations enable row level security;

-- Tarifs : lecture publique, écriture réservée au catalogue
drop policy if exists price_tiers_public_read on public.price_tiers;
create policy price_tiers_public_read on public.price_tiers
  for select to anon, authenticated using (true);

drop policy if exists price_tiers_staff_write on public.price_tiers;
create policy price_tiers_staff_write on public.price_tiers
  for all to authenticated
  using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

-- Réservation : seulement pour soi, et seulement si le produit est « en attente » et non archivé
drop policy if exists reservations_insert_own on public.reservations;
create policy reservations_insert_own on public.reservations
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'en_attente' and not p.is_archived
    )
  );

-- Lecture : ses propres réservations, ou toute l'équipe catalogue
drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations
  for select to authenticated
  using (user_id = auth.uid() or public.can_manage_catalogue());

-- Données de démonstration (FICTIVES) : tarifs dégressifs de l'exemple du cahier des charges
insert into public.price_tiers (product_id, min_qty, max_qty, unit_price_ht)
select id, 1, 9, 12500 from public.products where name like '[DÉMO] Écouteurs%'
union all
select id, 10, 49, 11000 from public.products where name like '[DÉMO] Écouteurs%'
union all
select id, 50, null, 10000 from public.products where name like '[DÉMO] Écouteurs%'
on conflict (product_id, min_qty) do nothing;
