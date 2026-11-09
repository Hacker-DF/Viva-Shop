-- ==========================================================================
-- phase4b-campagnes.sql — Viva Shop — Campagnes de collecte
-- À exécuter après phase2b-roles.sql.
-- Ouvrir ou clôturer une campagne met à jour automatiquement le statut de ses produits.
-- Un produit ne peut appartenir qu'à une seule campagne.
-- ==========================================================================

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  state text not null default 'brouillon' check (state in ('brouillon', 'ouverte', 'cloturee')),
  payment_deadline timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_products (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  product_id uuid not null unique references public.products(id) on delete cascade,
  primary key (campaign_id, product_id)
);

-- Statut produit déduit de l'état de la campagne
create or replace function public.campaign_status_for(p_state text)
returns text
language sql
immutable
as $$
  select case p_state
    when 'ouverte' then 'collecte_ouverte'
    when 'cloturee' then 'commande_cloturee'
    else 'en_attente'
  end;
$$;

-- Changement d'état d'une campagne : mise à jour des produits + journal
create or replace function public.campaign_state_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products p
     set status = public.campaign_status_for(new.state)
    from public.campaign_products cp
   where cp.product_id = p.id and cp.campaign_id = new.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'campagne_' || new.state, 'campaigns', new.id::text,
          jsonb_build_object('nom', new.name, 'statut_produits', public.campaign_status_for(new.state)));
  return null;
end;
$$;

drop trigger if exists campaign_state_after_update on public.campaigns;
create trigger campaign_state_after_update
  after update of state on public.campaigns
  for each row when (old.state is distinct from new.state)
  execute function public.campaign_state_sync();

-- Ajout d'un produit à une campagne : il prend le statut de la campagne ; retrait : retour à « en attente »
create or replace function public.campaign_product_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.products p
       set status = public.campaign_status_for(c.state)
      from public.campaigns c
     where p.id = new.product_id and c.id = new.campaign_id;
  else
    update public.products set status = 'en_attente' where id = old.product_id;
  end if;
  return null;
end;
$$;

drop trigger if exists campaign_product_link_trg on public.campaign_products;
create trigger campaign_product_link_trg
  after insert or delete on public.campaign_products
  for each row execute function public.campaign_product_link();

-- Droits : lecture publique, écriture réservée au catalogue
alter table public.campaigns enable row level security;
alter table public.campaign_products enable row level security;

drop policy if exists campaigns_public_read on public.campaigns;
create policy campaigns_public_read on public.campaigns
  for select to anon, authenticated using (true);
drop policy if exists campaigns_staff_write on public.campaigns;
create policy campaigns_staff_write on public.campaigns
  for all to authenticated using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

drop policy if exists campaign_products_public_read on public.campaign_products;
create policy campaign_products_public_read on public.campaign_products
  for select to anon, authenticated using (true);
drop policy if exists campaign_products_staff_write on public.campaign_products;
create policy campaign_products_staff_write on public.campaign_products
  for all to authenticated using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());
