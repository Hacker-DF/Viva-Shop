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
