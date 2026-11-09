-- ==========================================================================
-- VIVA SHOP — BASE DE DONNÉES COMPLÈTE (à coller une seule fois dans SQL Editor)
-- Contient, dans l'ordre : schema, policies, seed, phase3, phase3b, phase4, phase2b, phase4b
-- ==========================================================================

-- ################ schema.sql ################
-- ==========================================================================
-- schema.sql — Viva Shop — Phase 2 (authentification, profils, rôles)
-- À exécuter dans Supabase → SQL Editor, dans cet ordre (ce fichier puis policies.sql, seed.sql).
-- ==========================================================================

-- ---------- Rôles (référentiel) ----------
create table if not exists public.roles (
  code text primary key,
  label text not null,
  description text
);

-- ---------- Profils (1 ligne par utilisateur authentifié) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  first_name text not null check (char_length(first_name) between 2 and 60),
  last_name text not null check (char_length(last_name) between 2 and 60),
  phone text not null check (phone ~ '^\+?[0-9 ]{8,20}$'),
  city text check (city is null or char_length(city) <= 80),
  notification_prefs jsonb not null default '{"whatsapp": true, "email": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Attribution des rôles (séparée du profil : jamais modifiable par le client) ----------
create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_code text not null references public.roles(code),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_code)
);
create index if not exists user_roles_role_idx on public.user_roles(role_code);

-- ---------- Journal des actions sensibles ----------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Fonction de contrôle de rôle ----------
-- SECURITY DEFINER : évite la récursion RLS sur user_roles. Ne dépend que de auth.uid().
create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role_code = p_role
  );
$$;

-- ---------- Mise à jour automatique de updated_at ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- Création automatique du profil à l'inscription ----------
-- Les données viennent des métadonnées d'inscription. Aucun rôle n'est lu ici.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, first_name, last_name, phone, city)
  values (
    new.id,
    lower(new.raw_user_meta_data->>'username'),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'phone',
    nullif(new.raw_user_meta_data->>'city', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Premier administrateur (à exécuter UNE SEULE FOIS, après votre inscription) ----------
-- insert into public.user_roles (user_id, role_code)
--   select id, 'administrateur_principal' from public.profiles where username = 'votre_identifiant';

-- ################ policies.sql ################
-- ==========================================================================
-- policies.sql — Sécurité côté serveur (RLS). Source de vérité des permissions.
-- Le frontend ne contrôle que l'affichage ; ces règles protègent réellement les données.
-- ==========================================================================

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;

-- Aucun accès pour les visiteurs anonymes
revoke all on public.roles, public.profiles, public.user_roles, public.audit_logs from anon;

-- ---------- roles : lecture seule pour les connectés ----------
drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles
  for select to authenticated using (true);

-- ---------- profiles ----------
-- Un utilisateur voit son profil ; l'administrateur principal voit tous les profils.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role('administrateur_principal'));

-- Modification de son propre profil uniquement
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Colonnes modifiables par le client : jamais id, ni dates de création
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, phone, city, notification_prefs, username)
  on public.profiles to authenticated;
-- Pas de INSERT ni DELETE client : le profil est créé par le trigger, supprimé avec auth.users

-- ---------- user_roles ----------
-- Chacun peut lire ses propres rôles ; seul l'administrateur principal peut en attribuer ou retirer
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role('administrateur_principal'));

drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write on public.user_roles
  for all to authenticated
  using (public.has_role('administrateur_principal'))
  with check (public.has_role('administrateur_principal'));

-- ---------- audit_logs : lecture admin, écriture par fonctions serveur uniquement ----------
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated
  using (public.has_role('administrateur_principal'));

-- ################ seed.sql ################
-- ==========================================================================
-- seed.sql — Données de référence (sans données fictives de clients)
-- ==========================================================================

insert into public.roles (code, label, description) values
  ('administrateur_principal', 'Administrateur principal', 'Tous les droits de gestion ; attribue les rôles'),
  ('gestionnaire_produits',    'Gestionnaire produits',    'Gère le catalogue, les prix et les campagnes'),
  ('responsable_commandes',    'Responsable commandes',    'Traite les réservations et les commandes'),
  ('agent_financier',          'Agent financier',          'Vérifie les paiements et les justificatifs'),
  ('agent_chine',              'Agent en Chine',           'Achète et réceptionne les colis en Chine'),
  ('responsable_logistique',   'Responsable logistique',   'Suit les expéditions et l''arrivée au Togo'),
  ('agent_livraison',          'Agent de livraison',       'Livre les clients au Togo'),
  ('support_client',           'Support client',           'Répond aux demandes d''assistance')
on conflict (code) do nothing;

-- ################ phase3-boutique.sql ################
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

-- ################ phase3b-admin.sql ################
-- ==========================================================================
-- phase3b-admin.sql — Viva Shop — Journal des opérations sur le catalogue
-- À exécuter après phase3-boutique.sql.
-- Chaque création et chaque changement de prix, promotion, statut ou archivage est journalisé.
-- ==========================================================================

create or replace function public.audit_product_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, target_table, target_id, details)
    values (auth.uid(), 'produit_creation', 'products', new.id::text,
            jsonb_build_object('code', new.code, 'price_ht', new.price_ht));
  elsif new.price_ht <> old.price_ht
     or new.promo_price is distinct from old.promo_price
     or new.is_archived <> old.is_archived
     or new.status <> old.status then
    insert into public.audit_logs (actor_id, action, target_table, target_id, details)
    values (auth.uid(), 'produit_modification', 'products', new.id::text,
            jsonb_build_object(
              'code', new.code,
              'price_ht_avant', old.price_ht, 'price_ht_apres', new.price_ht,
              'promo_avant', old.promo_price, 'promo_apres', new.promo_price,
              'statut_avant', old.status, 'statut_apres', new.status,
              'archive', new.is_archived));
  end if;
  return null;
end;
$$;

drop trigger if exists products_audit on public.products;
create trigger products_audit
  after insert or update on public.products
  for each row execute function public.audit_product_changes();

-- ################ phase4-reservations.sql ################
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

-- ################ phase2b-roles.sql ################
-- ==========================================================================
-- phase2b-roles.sql — Viva Shop — Attribution des rôles par l'administrateur principal
-- À exécuter après phase4-reservations.sql. Chaque changement est journalisé.
-- ==========================================================================

create or replace function public.set_user_role(p_username text, p_role text, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if not public.has_role('administrateur_principal') then
    raise exception 'Action réservée à l''administrateur principal';
  end if;

  if not exists (select 1 from public.roles where code = p_role) then
    raise exception 'Rôle inconnu';
  end if;

  select id into target from public.profiles where username = lower(p_username);
  if target is null then
    raise exception 'Utilisateur introuvable : %', p_username;
  end if;

  -- Garde-fou : l'administrateur principal ne peut pas se retirer ce rôle lui-même
  if target = auth.uid() and p_role = 'administrateur_principal' and not p_grant then
    raise exception 'Vous ne pouvez pas retirer votre propre rôle d''administrateur principal';
  end if;

  if p_grant then
    insert into public.user_roles (user_id, role_code, granted_by)
    values (target, p_role, auth.uid())
    on conflict (user_id, role_code) do nothing;
  else
    delete from public.user_roles where user_id = target and role_code = p_role;
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (
    auth.uid(),
    case when p_grant then 'role_attribue' else 'role_retire' end,
    'user_roles',
    target::text,
    jsonb_build_object('username', lower(p_username), 'role', p_role)
  );
end;
$$;

-- Seuls les utilisateurs connectés peuvent appeler la fonction ; elle vérifie elle-même le rôle
revoke execute on function public.set_user_role(text, text, boolean) from public, anon;
grant execute on function public.set_user_role(text, text, boolean) to authenticated;

-- ################ phase4b-campagnes.sql ################
-- ==========================================================================
-- phase4b-campagnes.sql — Viva Shop — Campagnes de collecte
-- À exécuter après phase2b-roles.sql.
-- Ouvrir ou clôturer une campagne met à jour automatiquement le statut de ses produits.
-- Un produit ne peut appartenir qu'à une seule campagne.
-- ==========================================================================

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  state text not null default 'brouillon' check (state in ('brouillon', 'ouverte', 'cloturee')),
  payment_deadline timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_products (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  product_id uuid not null unique references public.products(id) on delete cascade,
  primary key (campaign_id, product_id)
);

-- Statut produit déduit de l'état de la campagne
create or replace function public.campaign_status_for(p_state text)
returns text
language sql
immutable
as $$
  select case p_state
    when 'ouverte' then 'collecte_ouverte'
    when 'cloturee' then 'commande_cloturee'
    else 'en_attente'
  end;
$$;

-- Changement d'état d'une campagne : mise à jour des produits + journal
create or replace function public.campaign_state_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products p
     set status = public.campaign_status_for(new.state)
    from public.campaign_products cp
   where cp.product_id = p.id and cp.campaign_id = new.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'campagne_' || new.state, 'campaigns', new.id::text,
          jsonb_build_object('nom', new.name, 'statut_produits', public.campaign_status_for(new.state)));
  return null;
end;
$$;

drop trigger if exists campaign_state_after_update on public.campaigns;
create trigger campaign_state_after_update
  after update of state on public.campaigns
  for each row when (old.state is distinct from new.state)
  execute function public.campaign_state_sync();

-- Ajout d'un produit à une campagne : il prend le statut de la campagne ; retrait : retour à « en attente »
create or replace function public.campaign_product_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.products p
       set status = public.campaign_status_for(c.state)
      from public.campaigns c
     where p.id = new.product_id and c.id = new.campaign_id;
  else
    update public.products set status = 'en_attente' where id = old.product_id;
  end if;
  return null;
end;
$$;

drop trigger if exists campaign_product_link_trg on public.campaign_products;
create trigger campaign_product_link_trg
  after insert or delete on public.campaign_products
  for each row execute function public.campaign_product_link();

-- Droits : lecture publique, écriture réservée au catalogue
alter table public.campaigns enable row level security;
alter table public.campaign_products enable row level security;

drop policy if exists campaigns_public_read on public.campaigns;
create policy campaigns_public_read on public.campaigns
  for select to anon, authenticated using (true);
drop policy if exists campaigns_staff_write on public.campaigns;
create policy campaigns_staff_write on public.campaigns
  for all to authenticated using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

drop policy if exists campaign_products_public_read on public.campaign_products;
create policy campaign_products_public_read on public.campaign_products
  for select to anon, authenticated using (true);
drop policy if exists campaign_products_staff_write on public.campaign_products;
create policy campaign_products_staff_write on public.campaign_products
  for all to authenticated using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

