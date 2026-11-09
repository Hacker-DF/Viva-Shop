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
