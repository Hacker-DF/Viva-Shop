-- ==========================================================================
-- phase24-dates-produit.sql — Viva Shop — Dates prévisionnelles sur la fiche produit
-- À exécuter après viva-shop-annulation.sql.
-- - order_date : date prévisionnelle de commande (affichée au client)
-- - reservation_deadline : dernier jour où l'on peut réserver (inclus).
--   Après cette date, la base refuse toute nouvelle réservation.
-- ==========================================================================

alter table public.products add column if not exists order_date date;
alter table public.products add column if not exists reservation_deadline date;

drop policy if exists reservations_insert_own on public.reservations;
create policy reservations_insert_own on public.reservations
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.status = 'en_attente'
        and not p.is_archived
        and (p.reservation_deadline is null or p.reservation_deadline >= current_date)
    )
  );
