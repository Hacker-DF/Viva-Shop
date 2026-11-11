-- ==========================================================================
-- phase21-couleurs-option.sql — Viva Shop — Un produit peut proposer ou non des couleurs
-- Par défaut : oui (les couleurs déjà saisies restent visibles).
-- ==========================================================================
alter table public.products add column if not exists has_colors boolean not null default true;
