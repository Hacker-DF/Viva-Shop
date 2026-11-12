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
