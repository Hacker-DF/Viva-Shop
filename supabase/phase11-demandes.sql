-- ==========================================================================
-- phase11-demandes.sql — Viva Shop — Commandes spéciales et annonces de la logistique
-- À exécuter après phase10-notifications.sql.
-- ==========================================================================

-- ---------- Commandes spéciales (produit absent du catalogue) ----------
create sequence if not exists public.special_order_seq;

create table if not exists public.special_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('CS-' || lpad(nextval('public.special_order_seq')::text, 6, '0')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_name text not null check (char_length(product_name) between 2 and 150),
  supplier_link text check (supplier_link is null or char_length(supplier_link) <= 300),
  description text check (description is null or char_length(description) <= 1000),
  quantity int not null check (quantity between 1 and 100000),
  budget integer check (budget is null or budget >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'recue'
    check (status in ('recue', 'etude', 'devis_envoye', 'acceptee', 'refusee', 'annulee')),
  quote_amount integer check (quote_amount is null or quote_amount >= 0),
  quote_note text check (quote_note is null or char_length(quote_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists special_orders_touch on public.special_orders;
create trigger special_orders_touch before update on public.special_orders
  for each row execute function public.touch_updated_at();

create or replace function public.can_handle_orders()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('administrateur_principal') or public.has_role('responsable_commandes');
$$;

create or replace function public.notify_special_order()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.user_id, 'Demande reçue',
      'Votre demande ' || new.reference || ' est enregistrée. Nous l’étudions.', '#/demande');
  elsif new.status is distinct from old.status then
    perform public.notify(new.user_id,
      'Demande ' || new.reference || ' : ' || case new.status
        when 'etude' then 'en étude'
        when 'devis_envoye' then 'devis disponible'
        when 'refusee' then 'refusée'
        when 'acceptee' then 'acceptée'
        when 'annulee' then 'annulée'
        else 'mise à jour' end,
      coalesce(new.quote_note, ''), '#/demande');
  end if;
  return null;
end;
$$;

drop trigger if exists special_orders_notify on public.special_orders;
create trigger special_orders_notify
  after insert or update of status on public.special_orders
  for each row execute function public.notify_special_order();

alter table public.special_orders enable row level security;

-- Le client crée et consulte ses demandes ; l'équipe les consulte et les traite
drop policy if exists special_orders_insert_own on public.special_orders;
create policy special_orders_insert_own on public.special_orders
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_account_active());

drop policy if exists special_orders_select on public.special_orders;
create policy special_orders_select on public.special_orders
  for select to authenticated
  using (user_id = auth.uid() or public.can_handle_orders());

drop policy if exists special_orders_update_staff on public.special_orders;
create policy special_orders_update_staff on public.special_orders
  for update to authenticated
  using (public.can_handle_orders()) with check (public.can_handle_orders());

-- Le personnel ne change que le statut et le devis
revoke update on public.special_orders from authenticated;
grant update (status, quote_amount, quote_note) on public.special_orders to authenticated;

-- ---------- Annonces : la logistique publie et supprime les siennes ----------
alter table public.announcements alter column created_by set default auth.uid();

drop policy if exists announcements_logistics_insert on public.announcements;
create policy announcements_logistics_insert on public.announcements
  for insert to authenticated
  with check (public.has_role('responsable_logistique') and created_by = auth.uid());

drop policy if exists announcements_logistics_own on public.announcements;
create policy announcements_logistics_own on public.announcements
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
