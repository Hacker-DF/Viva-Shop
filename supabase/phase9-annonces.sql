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
create policy announcements_public_read on public.announcements
  for select to anon, authenticated
  using (is_active and starts_at <= now() and (ends_at is null or ends_at > now()));

-- Écriture : gestionnaire produits et administrateur principal
drop policy if exists announcements_staff_write on public.announcements;
create policy announcements_staff_write on public.announcements
  for all to authenticated
  using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());
