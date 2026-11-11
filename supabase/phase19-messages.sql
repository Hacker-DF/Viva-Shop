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
