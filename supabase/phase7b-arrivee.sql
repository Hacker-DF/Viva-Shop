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
