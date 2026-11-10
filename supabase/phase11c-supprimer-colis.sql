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
