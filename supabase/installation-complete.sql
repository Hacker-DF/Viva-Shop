-- ==========================================================================
-- VIVA SHOP — INSTALLATION COMPLÈTE (un seul fichier)
-- À exécuter une seule fois dans SQL Editor, sur une base neuve OU existante.
-- Peut être relancé sans risque : chaque création est protégée.
-- Ne pas exécuter publication.sql ici : à lancer seulement avant la mise en ligne.
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
drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles
  for select to authenticated using (true);

-- ---------- profiles ----------
-- Un utilisateur voit son profil ; l'administrateur principal voit tous les profils.
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role('administrateur_principal'));

-- Modification de son propre profil uniquement
drop policy if exists profiles_update_own on public.profiles;
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
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role('administrateur_principal'));

drop policy if exists user_roles_admin_write on public.user_roles;
drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write on public.user_roles
  for all to authenticated
  using (public.has_role('administrateur_principal'))
  with check (public.has_role('administrateur_principal'));

-- ---------- audit_logs : lecture admin, écriture par fonctions serveur uniquement ----------
drop policy if exists audit_logs_admin_read on public.audit_logs;
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
drop trigger if exists products_insert_code on public.products;
create trigger products_insert_code
  before insert on public.products
  for each row execute function public.products_before_insert();

drop trigger if exists products_update_guard on public.products;
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
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active);

drop policy if exists products_public_read on public.products;
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated using (not is_archived);

-- Écriture réservée au gestionnaire produits et à l'administrateur principal
drop policy if exists categories_staff_write on public.categories;
drop policy if exists categories_staff_write on public.categories;
create policy categories_staff_write on public.categories
  for all to authenticated
  using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

drop policy if exists products_staff_write on public.products;
drop policy if exists products_staff_write on public.products;
create policy products_staff_write on public.products
  for all to authenticated
  using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

-- Favoris : chacun gère uniquement les siens
drop policy if exists favorites_own on public.favorites;
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
drop policy if exists price_tiers_public_read on public.price_tiers;
create policy price_tiers_public_read on public.price_tiers
  for select to anon, authenticated using (true);

drop policy if exists price_tiers_staff_write on public.price_tiers;
drop policy if exists price_tiers_staff_write on public.price_tiers;
create policy price_tiers_staff_write on public.price_tiers
  for all to authenticated
  using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

-- Réservation : seulement pour soi, et seulement si le produit est « en attente » et non archivé
drop policy if exists reservations_insert_own on public.reservations;
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
drop trigger if exists campaign_product_link_trg on public.campaign_products;
create trigger campaign_product_link_trg
  after insert or delete on public.campaign_products
  for each row execute function public.campaign_product_link();

-- Droits : lecture publique, écriture réservée au catalogue
alter table public.campaigns enable row level security;
alter table public.campaign_products enable row level security;

drop policy if exists campaigns_public_read on public.campaigns;
drop policy if exists campaigns_public_read on public.campaigns;
create policy campaigns_public_read on public.campaigns
  for select to anon, authenticated using (true);
drop policy if exists campaigns_staff_write on public.campaigns;
drop policy if exists campaigns_staff_write on public.campaigns;
create policy campaigns_staff_write on public.campaigns
  for all to authenticated using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

drop policy if exists campaign_products_public_read on public.campaign_products;
drop policy if exists campaign_products_public_read on public.campaign_products;
create policy campaign_products_public_read on public.campaign_products
  for select to anon, authenticated using (true);
drop policy if exists campaign_products_staff_write on public.campaign_products;
drop policy if exists campaign_products_staff_write on public.campaign_products;
create policy campaign_products_staff_write on public.campaign_products
  for all to authenticated using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());


-- ################ phase5-paiements.sql ################
-- ==========================================================================
-- phase5-paiements.sql — Viva Shop — Phase 5 : déclaration de paiement et vérification
-- À exécuter après phase4b-campagnes.sql. Une déclaration n'est PAS une confirmation de paiement.
-- Seul un agent financier peut confirmer ou rejeter une déclaration.
-- ==========================================================================

create sequence if not exists public.order_number_seq;

create table if not exists public.payment_declarations (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    default ('CMD-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant text check (char_length(variant) <= 60),
  quantity int not null check (quantity between 1 and 10000),
  payer_name text not null check (char_length(payer_name) between 2 and 100),
  payer_phone text check (payer_phone is null or payer_phone ~ '^\+?[0-9 ]{8,20}$'),
  amount integer not null check (amount > 0),
  payment_method text not null check (payment_method in ('mixx_by_yas', 'flooz', 'virement')),
  ref_code text check (ref_code is null or char_length(ref_code) between 4 and 60),
  txn_id text check (txn_id is null or char_length(txn_id) between 4 and 60),
  notes text check (char_length(notes) <= 500),
  status text not null default 'en_attente_verification'
    check (status in ('en_attente_verification', 'en_cours_verification', 'paiement_confirme',
                      'montant_incorrect', 'transaction_introuvable', 'declaration_rejetee', 'rembourse')),
  verification_note text,
  whatsapp_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Au moins une vraie référence est exigée
  constraint payment_has_reference check (ref_code is not null or txn_id is not null)
);
create index if not exists payment_declarations_user_idx on public.payment_declarations(user_id, created_at desc);

drop trigger if exists payment_declarations_touch on public.payment_declarations;
drop trigger if exists payment_declarations_touch on public.payment_declarations;
create trigger payment_declarations_touch
  before update on public.payment_declarations
  for each row execute function public.touch_updated_at();

-- Droit de vérification : agent financier ou administrateur principal
create or replace function public.can_verify_payments()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('agent_financier') or public.has_role('administrateur_principal');
$$;

-- Seule fonction autorisée à changer un statut de paiement (vérifie le droit et journalise)
create or replace function public.set_payment_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_verify_payments() then
    raise exception 'Action réservée à l''équipe financière';
  end if;
  if p_status not in ('en_cours_verification', 'paiement_confirme', 'montant_incorrect',
                      'transaction_introuvable', 'declaration_rejetee', 'rembourse') then
    raise exception 'Statut inconnu';
  end if;

  update public.payment_declarations
     set status = p_status, verification_note = p_note
   where id = p_id;
  if not found then
    raise exception 'Déclaration introuvable';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'paiement_' || p_status, 'payment_declarations', p_id::text,
          jsonb_build_object('note', p_note));
end;
$$;

revoke execute on function public.set_payment_status(uuid, text, text) from public, anon;
grant execute on function public.set_payment_status(uuid, text, text) to authenticated;

-- Droits
alter table public.payment_declarations enable row level security;

-- Déclarer : seulement pour soi, et seulement si la collecte du produit est ouverte
drop policy if exists payments_insert_own on public.payment_declarations;
drop policy if exists payments_insert_own on public.payment_declarations;
create policy payments_insert_own on public.payment_declarations
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'en_attente_verification'
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'collecte_ouverte' and not p.is_archived
    )
  );

-- Lecture : ses propres déclarations, ou l'équipe financière
drop policy if exists payments_select on public.payment_declarations;
drop policy if exists payments_select on public.payment_declarations;
create policy payments_select on public.payment_declarations
  for select to authenticated
  using (user_id = auth.uid() or public.can_verify_payments());

-- Mise à jour : seul le champ « transmis à un agent » est modifiable par le client
drop policy if exists payments_update_own on public.payment_declarations;
drop policy if exists payments_update_own on public.payment_declarations;
create policy payments_update_own on public.payment_declarations
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.payment_declarations from authenticated;
grant update (whatsapp_sent_at) on public.payment_declarations to authenticated;


-- ################ phase6-photos.sql ################
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
drop policy if exists produits_public_read on storage.objects;
create policy produits_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'produits');

drop policy if exists produits_staff_insert on storage.objects;
drop policy if exists produits_staff_insert on storage.objects;
create policy produits_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produits' and public.can_manage_catalogue());

drop policy if exists produits_staff_delete on storage.objects;
drop policy if exists produits_staff_delete on storage.objects;
create policy produits_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'produits' and public.can_manage_catalogue());


-- ################ phase12-tampon.sql ################
-- ==========================================================================
-- phase12-tampon.sql — Viva Shop — Date de validation pour le tampon du pro forma
-- À exécuter après phase11c-supprimer-colis.sql.
-- ==========================================================================

alter table public.payment_declarations add column if not exists verified_at timestamptz;

create or replace function public.set_payment_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.can_verify_payments() then
    raise exception 'Action réservée à l’équipe financière';
  end if;
  if p_status not in ('en_cours_verification', 'paiement_confirme', 'montant_incorrect',
                      'transaction_introuvable', 'declaration_rejetee', 'rembourse') then
    raise exception 'Statut inconnu';
  end if;

  update public.payment_declarations
     set status = p_status,
         verification_note = p_note,
         verified_at = case when p_status = 'paiement_confirme' then now() else verified_at end
   where id = p_id;
  if not found then
    raise exception 'Déclaration introuvable';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'paiement_' || p_status, 'payment_declarations', p_id::text,
          jsonb_build_object('note', p_note));
end;
$$;


-- ################ phase7-logistique.sql ################
-- ==========================================================================
-- phase7-logistique.sql — Viva Shop — Colis, couleurs et suivi
-- À exécuter après phase5-paiements.sql (et phase2b-roles.sql).
-- Un colis n'est créé qu'après paiement confirmé. Les statuts avancent par rôle, dans l'ordre.
-- ==========================================================================

create sequence if not exists public.tracking_seq;

-- Couleurs d'un produit, chacune avec sa photo
create table if not exists public.product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  photo_url text,
  unique (product_id, name)
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique
    default ('CN-' || lpad(nextval('public.tracking_seq')::text, 6, '0')),
  declaration_id uuid not null unique references public.payment_declarations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  color_name text,
  color_photo_url text,
  status text not null default 'transmise_chine'
    check (status in ('transmise_chine', 'achat_effectue', 'recu_chine', 'expedie', 'arrive_togo', 'en_livraison', 'livre')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null,
  comment text check (comment is null or char_length(comment) <= 300),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tracking_events_shipment_idx on public.tracking_events(shipment_id, created_at);

drop trigger if exists shipments_touch on public.shipments;
drop trigger if exists shipments_touch on public.shipments;
create trigger shipments_touch before update on public.shipments
  for each row execute function public.touch_updated_at();

-- Personnel logistique (lecture élargie)
create or replace function public.is_logistics_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('administrateur_principal') or public.has_role('agent_chine')
      or public.has_role('responsable_logistique') or public.has_role('agent_livraison');
$$;

-- Création d'un colis après paiement confirmé
create or replace function public.create_shipment(p_declaration uuid, p_color uuid default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  d_user uuid; d_product uuid; d_status text;
  col_name text; col_photo text; sid uuid; tn text;
begin
  if not (public.has_role('administrateur_principal') or public.has_role('responsable_logistique')) then
    raise exception 'Action réservée à la logistique';
  end if;

  select user_id, product_id, status into d_user, d_product, d_status
    from public.payment_declarations where id = p_declaration;
  if not found then raise exception 'Déclaration introuvable'; end if;
  if d_status <> 'paiement_confirme' then
    raise exception 'Le paiement doit être confirmé avant la création du colis';
  end if;

  if p_color is not null then
    select name, photo_url into col_name, col_photo
      from public.product_colors where id = p_color and product_id = d_product;
    if not found then raise exception 'Couleur inconnue pour ce produit'; end if;
  end if;

  insert into public.shipments (declaration_id, user_id, color_name, color_photo_url)
  values (p_declaration, d_user, col_name, col_photo)
  returning id, tracking_number into sid, tn;

  insert into public.tracking_events (shipment_id, status, comment, actor_id)
  values (sid, 'transmise_chine', 'Colis créé', auth.uid());

  return tn;
end;
$$;

-- Changement de statut : chaque rôle ne peut faire que sa propre étape
create or replace function public.set_shipment_status(p_id uuid, p_status text, p_comment text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare cur text; allowed boolean;
begin
  select status into cur from public.shipments where id = p_id;
  if not found then raise exception 'Colis introuvable'; end if;

  allowed := public.has_role('administrateur_principal')
    or (public.has_role('agent_chine') and ((cur = 'transmise_chine' and p_status = 'achat_effectue')
                                         or (cur = 'achat_effectue' and p_status = 'recu_chine')))
    or (public.has_role('responsable_logistique') and ((cur = 'recu_chine' and p_status = 'expedie')
                                                    or (cur = 'expedie' and p_status = 'arrive_togo')))
    or (public.has_role('agent_livraison') and ((cur = 'arrive_togo' and p_status = 'en_livraison')
                                             or (cur = 'en_livraison' and p_status = 'livre')));
  if not allowed then raise exception 'Cette étape n’est pas autorisée pour votre rôle'; end if;

  update public.shipments set status = p_status where id = p_id;
  insert into public.tracking_events (shipment_id, status, comment, actor_id)
  values (p_id, p_status, nullif(trim(coalesce(p_comment, '')), ''), auth.uid());
end;
$$;

revoke execute on function public.create_shipment(uuid, uuid) from public, anon;
revoke execute on function public.set_shipment_status(uuid, text, text) from public, anon;
grant execute on function public.create_shipment(uuid, uuid) to authenticated;
grant execute on function public.set_shipment_status(uuid, text, text) to authenticated;

-- Droits
alter table public.product_colors enable row level security;
alter table public.shipments enable row level security;
alter table public.tracking_events enable row level security;

drop policy if exists product_colors_public_read on public.product_colors;
drop policy if exists product_colors_public_read on public.product_colors;
create policy product_colors_public_read on public.product_colors
  for select to anon, authenticated using (true);
drop policy if exists product_colors_staff_write on public.product_colors;
drop policy if exists product_colors_staff_write on public.product_colors;
create policy product_colors_staff_write on public.product_colors
  for all to authenticated using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

-- Le client voit ses colis ; le personnel logistique voit tous les colis
drop policy if exists shipments_select on public.shipments;
drop policy if exists shipments_select on public.shipments;
create policy shipments_select on public.shipments
  for select to authenticated using (user_id = auth.uid() or public.is_logistics_staff());

drop policy if exists tracking_events_select on public.tracking_events;
drop policy if exists tracking_events_select on public.tracking_events;
create policy tracking_events_select on public.tracking_events
  for select to authenticated using (
    exists (select 1 from public.shipments s
            where s.id = shipment_id and (s.user_id = auth.uid() or public.is_logistics_staff()))
  );

-- Le personnel logistique voit aussi le nom des clients (nécessaire à l'affichage)
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.has_role('administrateur_principal')
    or public.can_verify_payments()
    or public.is_logistics_staff()
  );


-- ################ phase7b-arrivee.sql ################
-- ==========================================================================
-- phase7b-arrivee.sql — Viva Shop — Date d'arrivée estimée d'un colis
-- À exécuter après phase7-logistique.sql.
-- ==========================================================================

alter table public.shipments add column if not exists estimated_arrival date;

create or replace function public.set_estimated_arrival(p_id uuid, p_date date)
returns void
language plpgsql security definer set search_path = public
as $$
declare cur text;
begin
  if not (public.has_role('administrateur_principal') or public.has_role('responsable_logistique')) then
    raise exception 'Action réservée à la logistique';
  end if;

  update public.shipments set estimated_arrival = p_date where id = p_id
  returning status into cur;
  if not found then raise exception 'Colis introuvable'; end if;

  insert into public.tracking_events (shipment_id, status, comment, actor_id)
  values (p_id, cur, 'Date d’arrivée estimée : ' || to_char(p_date, 'DD/MM/YYYY'), auth.uid());
end;
$$;

revoke execute on function public.set_estimated_arrival(uuid, date) from public, anon;
grant execute on function public.set_estimated_arrival(uuid, date) to authenticated;


-- ################ phase8-finitions.sql ################
-- ==========================================================================
-- phase8-finitions.sql — Viva Shop — Suspension de compte et réclamations
-- À exécuter après phase7b-arrivee.sql.
-- ==========================================================================

-- ---------- Suspension de compte ----------
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists suspension_reason text;

create or replace function public.is_account_active()
returns boolean
language sql stable security definer set search_path = public
as $$
  select not coalesce((select is_suspended from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.set_account_suspended(p_user uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role('administrateur_principal') then
    raise exception 'Action réservée à l’administrateur principal';
  end if;
  if p_user = auth.uid() then
    raise exception 'Vous ne pouvez pas suspendre votre propre compte';
  end if;

  update public.profiles
     set is_suspended = p_suspended,
         suspension_reason = case when p_suspended then nullif(trim(coalesce(p_reason, '')), '') else null end
   where id = p_user;
  if not found then raise exception 'Utilisateur introuvable'; end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), case when p_suspended then 'compte_suspendu' else 'compte_reactive' end,
          'profiles', p_user::text, jsonb_build_object('raison', p_reason));
end;
$$;

revoke execute on function public.set_account_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.set_account_suspended(uuid, boolean, text) to authenticated;

-- Un compte suspendu ne peut plus réserver ni déclarer de paiement
drop policy if exists reservations_insert_own on public.reservations;
drop policy if exists reservations_insert_own on public.reservations;
create policy reservations_insert_own on public.reservations
  for insert to authenticated
  with check (
    user_id = auth.uid() and public.is_account_active()
    and exists (select 1 from public.products p
                where p.id = product_id and p.status = 'en_attente' and not p.is_archived)
  );

drop policy if exists payments_insert_own on public.payment_declarations;
drop policy if exists payments_insert_own on public.payment_declarations;
create policy payments_insert_own on public.payment_declarations
  for insert to authenticated
  with check (
    user_id = auth.uid() and public.is_account_active()
    and status = 'en_attente_verification'
    and exists (select 1 from public.products p
                where p.id = product_id and p.status = 'collecte_ouverte' and not p.is_archived)
  );

-- ---------- Réclamations ----------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 5 and 2000),
  status text not null default 'ouverte' check (status in ('ouverte', 'en_cours', 'resolue')),
  reply text check (reply is null or char_length(reply) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists support_tickets_touch on public.support_tickets;
drop trigger if exists support_tickets_touch on public.support_tickets;
create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function public.touch_updated_at();

create or replace function public.can_handle_tickets()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('administrateur_principal') or public.has_role('support_client')
      or public.has_role('responsable_commandes');
$$;

alter table public.support_tickets enable row level security;

drop policy if exists tickets_insert_own on public.support_tickets;
drop policy if exists tickets_insert_own on public.support_tickets;
create policy tickets_insert_own on public.support_tickets
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_account_active());

drop policy if exists tickets_select on public.support_tickets;
drop policy if exists tickets_select on public.support_tickets;
create policy tickets_select on public.support_tickets
  for select to authenticated
  using (user_id = auth.uid() or public.can_handle_tickets());

drop policy if exists tickets_update_staff on public.support_tickets;
drop policy if exists tickets_update_staff on public.support_tickets;
create policy tickets_update_staff on public.support_tickets
  for update to authenticated
  using (public.can_handle_tickets()) with check (public.can_handle_tickets());

-- Le personnel ne modifie que le statut et la réponse
revoke update on public.support_tickets from authenticated;
grant update (status, reply) on public.support_tickets to authenticated;

-- Le personnel de support voit le nom des clients
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.has_role('administrateur_principal')
    or public.can_verify_payments()
    or public.is_logistics_staff()
    or public.can_handle_tickets()
  );


-- ################ phase9-annonces.sql ################
-- ==========================================================================
-- phase9-annonces.sql — Viva Shop — Annonces affichées sur l'accueil
-- À exécuter après phase8-finitions.sql.
-- ==========================================================================

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  body text check (body is null or char_length(body) <= 1000),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- Lecture publique : seulement les annonces actives et dans leur période
drop policy if exists announcements_public_read on public.announcements;
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements
  for select to anon, authenticated
  using (is_active and starts_at <= now() and (ends_at is null or ends_at > now()));

-- Écriture : gestionnaire produits et administrateur principal
drop policy if exists announcements_staff_write on public.announcements;
drop policy if exists announcements_staff_write on public.announcements;
create policy announcements_staff_write on public.announcements
  for all to authenticated
  using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());


-- ################ phase10-notifications.sql ################
-- ==========================================================================
-- phase10-notifications.sql — Viva Shop — Notifications dans l'application
-- À exécuter après phase9-annonces.sql. Les notifications sont créées par la base
-- (déclencheurs) ; le client ne peut que les lire et les marquer comme lues.
-- ==========================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  body text check (body is null or char_length(body) <= 500),
  link text check (link is null or char_length(link) <= 200),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.notify(p_user uuid, p_title text, p_body text, p_link text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.notifications (user_id, title, body, link) values (p_user, p_title, p_body, p_link);
$$;
revoke execute on function public.notify(uuid, text, text, text) from public, anon, authenticated;

-- Libellés des statuts de paiement
create or replace function public.payment_label(p text)
returns text
language sql immutable
as $$
  select case p
    when 'en_cours_verification' then 'en cours de vérification'
    when 'paiement_confirme' then 'confirmé'
    when 'montant_incorrect' then 'signalé : montant incorrect'
    when 'transaction_introuvable' then 'signalé : transaction introuvable'
    when 'declaration_rejetee' then 'rejeté'
    when 'rembourse' then 'remboursé'
    else 'en attente de vérification'
  end;
$$;

-- Paiements : déclaration reçue, puis chaque changement de statut
create or replace function public.notify_payment()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.user_id, 'Déclaration reçue',
      'Votre déclaration ' || new.order_number || ' a bien été reçue. Notre équipe la vérifie.', '#/commandes');
  elsif new.status is distinct from old.status then
    perform public.notify(new.user_id, 'Paiement ' || public.payment_label(new.status),
      'Commande ' || new.order_number || '.', '#/commandes');
  end if;
  return null;
end;
$$;

drop trigger if exists payments_notify on public.payment_declarations;
drop trigger if exists payments_notify on public.payment_declarations;
create trigger payments_notify
  after insert or update of status on public.payment_declarations
  for each row execute function public.notify_payment();

-- Réservations
create or replace function public.notify_reservation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.notify(new.user_id, 'Réservation enregistrée',
    'Ce n’est pas un paiement. Vous serez prévenu à l’ouverture de la collecte.', '#/commandes');
  return null;
end;
$$;

drop trigger if exists reservations_notify on public.reservations;
drop trigger if exists reservations_notify on public.reservations;
create trigger reservations_notify
  after insert on public.reservations
  for each row execute function public.notify_reservation();

-- Colis : chaque étape et chaque date communiquée
create or replace function public.notify_tracking()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare owner uuid; etape text;
begin
  select user_id into owner from public.shipments where id = new.shipment_id;
  etape := case new.status
    when 'transmise_chine' then 'transmis à l’agent en Chine'
    when 'achat_effectue' then 'achat effectué'
    when 'recu_chine' then 'reçu en Chine'
    when 'expedie' then 'expédié vers le Togo'
    when 'arrive_togo' then 'arrivé au Togo'
    when 'en_livraison' then 'en cours de livraison'
    when 'livre' then 'livré'
    else null
  end;
  if etape is not null then
    perform public.notify(owner, 'Votre colis : ' || etape,
      coalesce(new.comment, 'Consultez Mes colis pour le détail.'), '#/commandes');
  end if;
  return null;
end;
$$;

drop trigger if exists tracking_notify on public.tracking_events;
drop trigger if exists tracking_notify on public.tracking_events;
create trigger tracking_notify
  after insert on public.tracking_events
  for each row execute function public.notify_tracking();

-- Ouverture d'une campagne : prévenir ceux qui suivent un de ses produits
create or replace function public.notify_campaign()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.state = 'ouverte' then
    insert into public.notifications (user_id, title, body, link)
    select distinct f.user_id, 'Collecte ouverte : ' || new.name,
           'Un produit que vous suivez peut maintenant être réservé et payé.', '#/favoris'
    from public.favorites f
    join public.campaign_products cp on cp.product_id = f.product_id
    where cp.campaign_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists campaigns_notify on public.campaigns;
drop trigger if exists campaigns_notify on public.campaigns;
create trigger campaigns_notify
  after update of state on public.campaigns
  for each row when (old.state is distinct from new.state)
  execute function public.notify_campaign();

-- Droits : chacun lit ses notifications et marque ses lectures ; personne ne les crée
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;


-- ################ phase11-demandes.sql ################
-- ==========================================================================
-- phase11-demandes.sql — Viva Shop — Commandes spéciales et annonces de la logistique
-- À exécuter après phase10-notifications.sql.
-- ==========================================================================

-- ---------- Commandes spéciales (produit absent du catalogue) ----------
create sequence if not exists public.special_order_seq;

create table if not exists public.special_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('CS-' || lpad(nextval('public.special_order_seq')::text, 6, '0')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_name text not null check (char_length(product_name) between 2 and 150),
  supplier_link text check (supplier_link is null or char_length(supplier_link) <= 300),
  description text check (description is null or char_length(description) <= 1000),
  quantity int not null check (quantity between 1 and 100000),
  budget integer check (budget is null or budget >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'recue'
    check (status in ('recue', 'etude', 'devis_envoye', 'acceptee', 'refusee', 'annulee')),
  quote_amount integer check (quote_amount is null or quote_amount >= 0),
  quote_note text check (quote_note is null or char_length(quote_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists special_orders_touch on public.special_orders;
drop trigger if exists special_orders_touch on public.special_orders;
create trigger special_orders_touch before update on public.special_orders
  for each row execute function public.touch_updated_at();

create or replace function public.can_handle_orders()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('administrateur_principal') or public.has_role('responsable_commandes');
$$;

create or replace function public.notify_special_order()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.user_id, 'Demande reçue',
      'Votre demande ' || new.reference || ' est enregistrée. Nous l’étudions.', '#/demande');
  elsif new.status is distinct from old.status then
    perform public.notify(new.user_id,
      'Demande ' || new.reference || ' : ' || case new.status
        when 'etude' then 'en étude'
        when 'devis_envoye' then 'devis disponible'
        when 'refusee' then 'refusée'
        when 'acceptee' then 'acceptée'
        when 'annulee' then 'annulée'
        else 'mise à jour' end,
      coalesce(new.quote_note, ''), '#/demande');
  end if;
  return null;
end;
$$;

drop trigger if exists special_orders_notify on public.special_orders;
drop trigger if exists special_orders_notify on public.special_orders;
create trigger special_orders_notify
  after insert or update of status on public.special_orders
  for each row execute function public.notify_special_order();

alter table public.special_orders enable row level security;

-- Le client crée et consulte ses demandes ; l'équipe les consulte et les traite
drop policy if exists special_orders_insert_own on public.special_orders;
drop policy if exists special_orders_insert_own on public.special_orders;
create policy special_orders_insert_own on public.special_orders
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_account_active());

drop policy if exists special_orders_select on public.special_orders;
drop policy if exists special_orders_select on public.special_orders;
create policy special_orders_select on public.special_orders
  for select to authenticated
  using (user_id = auth.uid() or public.can_handle_orders());

drop policy if exists special_orders_update_staff on public.special_orders;
drop policy if exists special_orders_update_staff on public.special_orders;
create policy special_orders_update_staff on public.special_orders
  for update to authenticated
  using (public.can_handle_orders()) with check (public.can_handle_orders());

-- Le personnel ne change que le statut et le devis
revoke update on public.special_orders from authenticated;
grant update (status, quote_amount, quote_note) on public.special_orders to authenticated;

-- ---------- Annonces : la logistique publie et supprime les siennes ----------
alter table public.announcements alter column created_by set default auth.uid();

drop policy if exists announcements_logistics_insert on public.announcements;
drop policy if exists announcements_logistics_insert on public.announcements;
create policy announcements_logistics_insert on public.announcements
  for insert to authenticated
  with check (public.has_role('responsable_logistique') and created_by = auth.uid());

drop policy if exists announcements_logistics_own on public.announcements;
drop policy if exists announcements_logistics_own on public.announcements;
create policy announcements_logistics_own on public.announcements
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());


-- ################ phase11b-photo-demande.sql ################
-- ==========================================================================
-- phase11b-photo-demande.sql — Viva Shop — Photo jointe à une demande spéciale
-- À exécuter après phase11-demandes.sql.
-- Le client peut téléverser une photo, uniquement dans le dossier « demandes ».
-- ==========================================================================

alter table public.special_orders add column if not exists image_url text;

-- Téléversement par le client, limité au dossier « demandes » du bucket produits
drop policy if exists produits_client_demande_insert on storage.objects;
drop policy if exists produits_client_demande_insert on storage.objects;
create policy produits_client_demande_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produits' and (storage.foldername(name))[1] = 'demandes');


-- ################ phase11c-supprimer-colis.sql ################
-- ==========================================================================
-- phase11c-supprimer-colis.sql — Viva Shop — Supprimer un colis créé par erreur
-- À exécuter après phase11b-photo-demande.sql.
-- La logistique supprime un colis tant qu'il n'a pas avancé ; l'administrateur principal peut
-- supprimer un colis dans tous les cas. Chaque suppression est journalisée.
-- ==========================================================================

create or replace function public.delete_shipment(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare st text; tn text;
begin
  if not (public.has_role('administrateur_principal') or public.has_role('responsable_logistique')) then
    raise exception 'Action réservée à la logistique';
  end if;

  select status, tracking_number into st, tn from public.shipments where id = p_id;
  if not found then raise exception 'Colis introuvable'; end if;

  if st <> 'transmise_chine' and not public.has_role('administrateur_principal') then
    raise exception 'Ce colis a déjà avancé : seul l’administrateur principal peut le supprimer';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'colis_supprime', 'shipments', p_id::text,
          jsonb_build_object('suivi', tn, 'statut', st));

  delete from public.shipments where id = p_id;
end;
$$;

revoke execute on function public.delete_shipment(uuid) from public, anon;
grant execute on function public.delete_shipment(uuid) to authenticated;


-- ################ phase13-galerie.sql ################
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
drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read on public.product_images
  for select to anon, authenticated using (true);

drop policy if exists product_images_staff_write on public.product_images;
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
drop policy if exists justificatifs_insert_own on storage.objects;
create policy justificatifs_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'justificatifs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists justificatifs_select on storage.objects;
drop policy if exists justificatifs_select on storage.objects;
create policy justificatifs_select on storage.objects
  for select to authenticated
  using (bucket_id = 'justificatifs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.can_verify_payments()));


-- ################ phase14-couleurs.sql ################
-- ==========================================================================
-- phase14-couleurs.sql — Viva Shop — La logistique ajoute les couleurs disponibles
-- À exécuter après viva-shop-galerie.sql.
-- ==========================================================================

drop policy if exists product_colors_logistics_insert on public.product_colors;
drop policy if exists product_colors_logistics_insert on public.product_colors;
create policy product_colors_logistics_insert on public.product_colors
  for insert to authenticated
  with check (public.has_role('responsable_logistique'));


-- ################ phase15-qr.sql ################
-- ==========================================================================
-- phase15-qr.sql — Viva Shop — Code QR de vérification du pro forma
-- À exécuter après viva-shop-couleurs.sql.
-- La vérification ne renvoie que le numéro de commande, le produit et le statut : aucune donnée personnelle.
-- ==========================================================================

alter table public.payment_declarations
  add column if not exists verify_token uuid not null default gen_random_uuid();

create unique index if not exists payment_declarations_verify_token_idx
  on public.payment_declarations(verify_token);

create or replace function public.verify_declaration(p_token uuid)
returns table(order_number text, status text, product_name text, verified_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select d.order_number, d.status, p.name, d.verified_at
  from public.payment_declarations d
  join public.products p on p.id = d.product_id
  where d.verify_token = p_token;
$$;

grant execute on function public.verify_declaration(uuid) to anon, authenticated;


-- ################ phase16-devis-photo.sql ################
-- ==========================================================================
-- phase16-devis-photo.sql — Viva Shop — Acceptation du devis et photo de profil
-- À exécuter après viva-shop-qr.sql.
-- ==========================================================================

-- Le client accepte ou refuse le devis reçu (et seulement celui-là)
drop policy if exists special_orders_client_decision on public.special_orders;
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
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- ################ phase17-adresses.sql ################
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
drop policy if exists addresses_own on public.addresses;
create policy addresses_own on public.addresses
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_account_active());


-- ################ phase18-affectation.sql ################
-- ==========================================================================
-- phase18-affectation.sql — Viva Shop — Affecter un colis à un agent
-- À exécuter après viva-shop-qr.sql (ou après la dernière mise à jour exécutée).
-- Un colis affecté ne peut être avancé que par son agent (et l'administrateur principal).
-- ==========================================================================

alter table public.shipments add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

-- Affectation (ou retrait avec un nom vide) par le responsable logistique
create or replace function public.assign_shipment(p_id uuid, p_username text)
returns void
language plpgsql security definer set search_path = public
as $$
declare agent uuid;
begin
  if not (public.has_role('administrateur_principal') or public.has_role('responsable_logistique')) then
    raise exception 'Action réservée à la logistique';
  end if;

  if p_username is null or trim(p_username) = '' then
    update public.shipments set assigned_to = null where id = p_id;
    if not found then raise exception 'Colis introuvable'; end if;
    return;
  end if;

  select id into agent from public.profiles where username = lower(trim(p_username));
  if agent is null then raise exception 'Utilisateur introuvable'; end if;
  if not exists (select 1 from public.user_roles ur
                 where ur.user_id = agent
                   and ur.role_code in ('agent_chine', 'responsable_logistique', 'agent_livraison', 'administrateur_principal')) then
    raise exception 'Cette personne n’a pas de rôle logistique';
  end if;

  update public.shipments set assigned_to = agent where id = p_id;
  if not found then raise exception 'Colis introuvable'; end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'colis_affecte', 'shipments', p_id::text, jsonb_build_object('agent', lower(trim(p_username))));
end;
$$;

revoke execute on function public.assign_shipment(uuid, text) from public, anon;
grant execute on function public.assign_shipment(uuid, text) to authenticated;

-- Avancer une étape : seul l'agent affecté peut le faire (l'administrateur principal aussi)
create or replace function public.set_shipment_status(p_id uuid, p_status text, p_comment text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare cur text; assignee uuid; allowed boolean;
begin
  select status, assigned_to into cur, assignee from public.shipments where id = p_id;
  if not found then raise exception 'Colis introuvable'; end if;

  if assignee is not null and assignee <> auth.uid() and not public.has_role('administrateur_principal') then
    raise exception 'Ce colis est affecté à un autre agent';
  end if;

  allowed := public.has_role('administrateur_principal')
    or (public.has_role('agent_chine') and ((cur = 'transmise_chine' and p_status = 'achat_effectue')
                                         or (cur = 'achat_effectue' and p_status = 'recu_chine')))
    or (public.has_role('responsable_logistique') and ((cur = 'recu_chine' and p_status = 'expedie')
                                                    or (cur = 'expedie' and p_status = 'arrive_togo')))
    or (public.has_role('agent_livraison') and ((cur = 'arrive_togo' and p_status = 'en_livraison')
                                             or (cur = 'en_livraison' and p_status = 'livre')));
  if not allowed then raise exception 'Cette étape n’est pas autorisée pour votre rôle'; end if;

  update public.shipments set status = p_status where id = p_id;
  insert into public.tracking_events (shipment_id, status, comment, actor_id)
  values (p_id, p_status, nullif(trim(coalesce(p_comment, '')), ''), auth.uid());
end;
$$;


-- ################ phase19-messages.sql ################
-- ==========================================================================
-- phase19-messages.sql — Viva Shop — L'équipe écrit aux clients
-- Le client ne peut pas écrire ce message : il arrive dans ses notifications.
-- ==========================================================================

create or replace function public.send_user_message(p_user uuid, p_title text, p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.has_role('administrateur_principal') or public.has_role('support_client')
          or public.has_role('responsable_commandes')) then
    raise exception 'Action réservée à l’équipe Viva Shop';
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 then raise exception 'Le titre doit comporter au moins 3 caractères'; end if;
  if char_length(coalesce(p_body, '')) > 500 then raise exception 'Le message ne peut pas dépasser 500 caractères'; end if;

  insert into public.notifications (user_id, title, body, link)
  values (p_user, 'Message de l’équipe Viva Shop : ' || trim(p_title), nullif(trim(coalesce(p_body, '')), ''), null);

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'message_envoye', 'profiles', p_user::text, jsonb_build_object('titre', trim(p_title)));
end;
$$;

revoke execute on function public.send_user_message(uuid, text, text) from public, anon;
grant execute on function public.send_user_message(uuid, text, text) to authenticated;


-- ################ phase20-supprimer-produit.sql ################
-- ==========================================================================
-- phase20-supprimer-produit.sql — Viva Shop — Supprimer un produit
-- Refusé si le produit a déjà des réservations ou des paiements (il faut l'archiver).
-- ==========================================================================

create or replace function public.delete_product(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare pname text;
begin
  if not public.can_manage_catalogue() then
    raise exception 'Action réservée à l’équipe catalogue';
  end if;

  select name into pname from public.products where id = p_id;
  if not found then raise exception 'Produit introuvable'; end if;

  if exists (select 1 from public.payment_declarations where product_id = p_id)
     or exists (select 1 from public.reservations where product_id = p_id) then
    raise exception 'Ce produit a déjà des réservations ou des paiements : archivez-le au lieu de le supprimer';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'produit_supprime', 'products', p_id::text, jsonb_build_object('nom', pname));

  delete from public.products where id = p_id;
end;
$$;

revoke execute on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated;


-- ################ phase21-couleurs-option.sql ################
-- ==========================================================================
-- phase21-couleurs-option.sql — Viva Shop — Un produit peut proposer ou non des couleurs
-- Par défaut : oui (les couleurs déjà saisies restent visibles).
-- ==========================================================================
alter table public.products add column if not exists has_colors boolean not null default true;


-- ################ phase22-proforma.sql ################
-- ==========================================================================
-- phase22-proforma.sql — Viva Shop — Date du paiement reçu, pour le pro forma
-- À exécuter après viva-shop-rattrapage.sql.
-- L'administrateur saisit la date de réception du paiement en confirmant.
-- ==========================================================================

alter table public.payment_declarations add column if not exists payment_date date;

drop function if exists public.set_payment_status(uuid, text, text);

create or replace function public.set_payment_status(p_id uuid, p_status text, p_note text default null, p_payment_date date default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.can_verify_payments() then
    raise exception 'Action réservée à l’équipe financière';
  end if;
  if p_status not in ('en_cours_verification', 'paiement_confirme', 'montant_incorrect',
                      'transaction_introuvable', 'declaration_rejetee', 'rembourse') then
    raise exception 'Statut inconnu';
  end if;

  update public.payment_declarations
     set status = p_status,
         verification_note = p_note,
         verified_at = case when p_status = 'paiement_confirme' then now() else verified_at end,
         payment_date = case when p_status = 'paiement_confirme' then coalesce(p_payment_date, current_date) else payment_date end
   where id = p_id;
  if not found then
    raise exception 'Déclaration introuvable';
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'paiement_' || p_status, 'payment_declarations', p_id::text,
          jsonb_build_object('note', p_note, 'date_paiement', p_payment_date));
end;
$$;

revoke execute on function public.set_payment_status(uuid, text, text, date) from public, anon;
grant execute on function public.set_payment_status(uuid, text, text, date) to authenticated;


-- ################ phase23-annulation-reservation.sql ################
-- ==========================================================================
-- phase23-annulation-reservation.sql — Viva Shop — Le client annule sa réservation
-- À exécuter après viva-shop-proforma.sql. Une annulation ne touche pas aux paiements.
-- ==========================================================================

create or replace function public.cancel_reservation(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  select rs.id, rs.user_id, rs.status, p.status as product_status
    into r
    from public.reservations rs
    join public.products p on p.id = rs.product_id
   where rs.id = p_id;

  if not found or r.user_id <> auth.uid() then
    raise exception 'Réservation introuvable';
  end if;
  if r.status = 'annulee' then
    raise exception 'Cette réservation est déjà annulée';
  end if;
  if r.product_status = 'commande_cloturee' then
    raise exception 'La commande est clôturée : cette réservation ne peut plus être annulée. Écrivez à un assistant.';
  end if;

  update public.reservations set status = 'annulee' where id = p_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'reservation_annulee', 'reservations', p_id::text, '{}'::jsonb);
end;
$$;

revoke execute on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.cancel_reservation(uuid) to authenticated;


-- ################ phase24-dates-produit.sql ################
-- ==========================================================================
-- phase24-dates-produit.sql — Viva Shop — Dates prévisionnelles sur la fiche produit
-- À exécuter après viva-shop-annulation.sql.
-- - order_date : date prévisionnelle de commande (affichée au client)
-- - reservation_deadline : dernier jour où l'on peut réserver (inclus).
--   Après cette date, la base refuse toute nouvelle réservation.
-- ==========================================================================

alter table public.products add column if not exists order_date date;
alter table public.products add column if not exists reservation_deadline date;

drop policy if exists reservations_insert_own on public.reservations;
drop policy if exists reservations_insert_own on public.reservations;
create policy reservations_insert_own on public.reservations
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.status = 'en_attente'
        and not p.is_archived
        and (p.reservation_deadline is null or p.reservation_deadline >= current_date)
    )
  );


-- ################ phase26-push.sql ################
-- ==========================================================================
-- phase26-push.sql — Notifications sur le téléphone (abonnements Web Push)
-- Chaque téléphone qui active les notifications enregistre son abonnement ici.
-- L'envoi est fait côté serveur (fonction send-push), avec la clé de service.
-- ==========================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_own on public.push_subscriptions;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

