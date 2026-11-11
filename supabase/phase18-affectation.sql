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
