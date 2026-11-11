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
