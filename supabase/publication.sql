-- ==========================================================================
-- publication.sql — Viva Shop — Contrôles avant mise en ligne
-- À exécuter dans SQL Editor. Chaque bloc se lance séparément (New query).
-- ==========================================================================

-- 1. Archiver les produits de démonstration (on archive, on ne supprime jamais)
update public.products set is_archived = true where name like '[DÉMO]%';

-- 2. Contrôle : toutes les tables publiques ont la sécurité activée (résultat attendu : aucune ligne)
select tablename from pg_tables
where schemaname = 'public' and rowsecurity = false
order by tablename;

-- 3. Contrôle : les rôles et les comptes administrateurs (résultat attendu : une ligne par responsable)
select p.username, r.code
from public.user_roles ur
join public.profiles p on p.id = ur.user_id
join public.roles r on r.code = ur.role_code
order by r.code, p.username;

-- 4. Contrôle : nombre de produits actifs après archivage
select count(*) as produits_actifs from public.products where is_archived = false;
