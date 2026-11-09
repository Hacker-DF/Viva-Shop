-- ==========================================================================
-- phase3b-admin.sql — Viva Shop — Journal des opérations sur le catalogue
-- À exécuter après phase3-boutique.sql.
-- Chaque création et chaque changement de prix, promotion, statut ou archivage est journalisé.
-- ==========================================================================

create or replace function public.audit_product_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, target_table, target_id, details)
    values (auth.uid(), 'produit_creation', 'products', new.id::text,
            jsonb_build_object('code', new.code, 'price_ht', new.price_ht));
  elsif new.price_ht <> old.price_ht
     or new.promo_price is distinct from old.promo_price
     or new.is_archived <> old.is_archived
     or new.status <> old.status then
    insert into public.audit_logs (actor_id, action, target_table, target_id, details)
    values (auth.uid(), 'produit_modification', 'products', new.id::text,
            jsonb_build_object(
              'code', new.code,
              'price_ht_avant', old.price_ht, 'price_ht_apres', new.price_ht,
              'promo_avant', old.promo_price, 'promo_apres', new.promo_price,
              'statut_avant', old.status, 'statut_apres', new.status,
              'archive', new.is_archived));
  end if;
  return null;
end;
$$;

drop trigger if exists products_audit on public.products;
create trigger products_audit
  after insert or update on public.products
  for each row execute function public.audit_product_changes();
