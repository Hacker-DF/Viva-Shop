-- ==========================================================================
-- verifier-installation.sql — Contrôle des scripts déjà exécutés
-- Lancer dans SQL Editor. Un résultat vide = élément présent.
-- Si une ligne apparaît, exécutez le script correspondant dans l'ordre de la liste.
-- ==========================================================================

-- Tables manquantes
with tables_attendues(nom) as (values
  ('announcements'), ('notifications'), ('special_orders'), ('support_tickets'),
  ('shipments'), ('tracking_events'), ('product_colors'), ('campaigns'),
  ('campaign_products'), ('favorites'), ('price_tiers'), ('reservations'),
  ('payment_declarations'), ('audit_logs'), ('user_roles'), ('roles'))
select 'table manquante : ' || t.nom as resultat
from tables_attendues t
where not exists (select 1 from information_schema.tables i
                  where i.table_schema = 'public' and i.table_name = t.nom);

-- Colonnes manquantes
with colonnes_attendues(table_name, column_name) as (values
  ('special_orders', 'image_url'), ('profiles', 'is_suspended'),
  ('shipments', 'estimated_arrival'), ('payment_declarations', 'verified_at'),
  ('announcements', 'created_by'), ('support_tickets', 'status'))
select 'colonne manquante : ' || c.table_name || '.' || c.column_name as resultat
from colonnes_attendues c
where not exists (select 1 from information_schema.columns i
                  where i.table_schema = 'public' and i.table_name = c.table_name
                    and i.column_name = c.column_name);
