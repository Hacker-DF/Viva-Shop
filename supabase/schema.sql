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
