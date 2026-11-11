-- ==========================================================================
-- phase14-couleurs.sql — Viva Shop — La logistique ajoute les couleurs disponibles
-- À exécuter après viva-shop-galerie.sql.
-- ==========================================================================

drop policy if exists product_colors_logistics_insert on public.product_colors;
create policy product_colors_logistics_insert on public.product_colors
  for insert to authenticated
  with check (public.has_role('responsable_logistique'));
