-- ==========================================================================
-- phase3-boutique.sql — Viva Shop — Phase 3 : catégories, produits, codes uniques, favoris
-- À exécuter après schema.sql et policies.sql.
-- ==========================================================================

-- ---------- Catégories (administrables) ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  position int not null default 0,
  is_active boolean not null default true
);

-- ---------- Produits ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{2}[A-Z]{6}$'),
  name text not null check (char_length(name) between 2 and 150),
  category_id uuid references public.categories(id) on delete restrict,
  description text,
  price_ht integer not null check (price_ht >= 0),          -- montant en FCFA (entier)
  promo_price integer check (promo_price is null or promo_price >= 0),
  main_image_url text,
  status text not null default 'en_attente'
    check (status in ('en_attente', 'collecte_ouverte', 'commande_cloturee', 'situation_particuliere')),
  is_archived boolean not null default false,               -- archiver, jamais supprimer : le code ne doit pas être réutilisé
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_created_idx on public.products(created_at desc);

-- ---------- Génération du code produit : 2 chiffres + 6 lettres, unique ----------
create or replace function public.generate_product_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text;
  letters constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
begin
  loop
    candidate := lpad(floor(random() * 100)::int::text, 2, '0');
    for i in 1..6 loop
      candidate := candidate || substr(letters, floor(random() * 26)::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.products where code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.products_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.generate_product_code();
  end if;
  return new;
end;
$$;

create or replace function public.products_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.code <> old.code then
    raise exception 'Le code produit ne peut pas être modifié';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_insert_code on public.products;
create trigger products_insert_code
  before insert on public.products
  for each row execute function public.products_before_insert();

drop trigger if exists products_update_guard on public.products;
create trigger products_update_guard
  before update on public.products
  for each row execute function public.products_before_update();

-- ---------- Favoris ----------
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------- Droits : catalogue et favoris ----------
create or replace function public.can_manage_catalogue()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('gestionnaire_produits') or public.has_role('administrateur_principal');
$$;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.favorites enable row level security;

-- Catalogue public : visible sans connexion, uniquement les éléments actifs / non archivés
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active);

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated using (not is_archived);

-- Écriture réservée au gestionnaire produits et à l'administrateur principal
drop policy if exists categories_staff_write on public.categories;
create policy categories_staff_write on public.categories
  for all to authenticated
  using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

drop policy if exists products_staff_write on public.products;
create policy products_staff_write on public.products
  for all to authenticated
  using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

-- Favoris : chacun gère uniquement les siens
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Données de démonstration (FICTIVES, à supprimer avant la mise en production) ----------
insert into public.categories (slug, name, position) values
  ('informatique-accessoires', 'Informatique et accessoires', 1),
  ('telephones-tablettes', 'Téléphones et tablettes', 2),
  ('electronique', 'Électronique', 3),
  ('mode-vetements', 'Mode et vêtements', 4),
  ('beaute', 'Beauté', 5),
  ('maison-decoration', 'Maison et décoration', 6),
  ('cuisine', 'Cuisine', 7),
  ('automobile-moto', 'Automobile et moto', 8),
  ('sport', 'Sport', 9),
  ('enfants-jouets', 'Enfants et jouets', 10),
  ('materiel-professionnel', 'Matériel professionnel et outils', 11),
  ('autres', 'Autres produits', 12)
on conflict (slug) do nothing;

insert into public.products (name, category_id, description, price_ht, status)
select '[DÉMO] Écouteurs sans fil (fictif)', id, 'Produit fictif pour tester la boutique.', 12500, 'en_attente'
  from public.categories where slug = 'electronique'
union all
select '[DÉMO] Lampe de bureau LED (fictive)', id, 'Produit fictif pour tester la boutique.', 8000, 'collecte_ouverte'
  from public.categories where slug = 'maison-decoration';
