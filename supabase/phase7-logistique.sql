-- ==========================================================================
-- phase7-logistique.sql — Viva Shop — Colis, couleurs et suivi
-- À exécuter après phase5-paiements.sql (et phase2b-roles.sql).
-- Un colis n'est créé qu'après paiement confirmé. Les statuts avancent par rôle, dans l'ordre.
-- ==========================================================================

create sequence if not exists public.tracking_seq;

-- Couleurs d'un produit, chacune avec sa photo
create table if not exists public.product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  photo_url text,
  unique (product_id, name)
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique
    default ('CN-' || lpad(nextval('public.tracking_seq')::text, 6, '0')),
  declaration_id uuid not null unique references public.payment_declarations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  color_name text,
  color_photo_url text,
  status text not null default 'transmise_chine'
    check (status in ('transmise_chine', 'achat_effectue', 'recu_chine', 'expedie', 'arrive_togo', 'en_livraison', 'livre')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null,
  comment text check (comment is null or char_length(comment) <= 300),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tracking_events_shipment_idx on public.tracking_events(shipment_id, created_at);

drop trigger if exists shipments_touch on public.shipments;
create trigger shipments_touch before update on public.shipments
  for each row execute function public.touch_updated_at();

-- Personnel logistique (lecture élargie)
create or replace function public.is_logistics_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('administrateur_principal') or public.has_role('agent_chine')
      or public.has_role('responsable_logistique') or public.has_role('agent_livraison');
$$;

-- Création d'un colis après paiement confirmé
create or replace function public.create_shipment(p_declaration uuid, p_color uuid default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  d_user uuid; d_product uuid; d_status text;
  col_name text; col_photo text; sid uuid; tn text;
begin
  if not (public.has_role('administrateur_principal') or public.has_role('responsable_logistique')) then
    raise exception 'Action réservée à la logistique';
  end if;

  select user_id, product_id, status into d_user, d_product, d_status
    from public.payment_declarations where id = p_declaration;
  if not found then raise exception 'Déclaration introuvable'; end if;
  if d_status <> 'paiement_confirme' then
    raise exception 'Le paiement doit être confirmé avant la création du colis';
  end if;

  if p_color is not null then
    select name, photo_url into col_name, col_photo
      from public.product_colors where id = p_color and product_id = d_product;
    if not found then raise exception 'Couleur inconnue pour ce produit'; end if;
  end if;

  insert into public.shipments (declaration_id, user_id, color_name, color_photo_url)
  values (p_declaration, d_user, col_name, col_photo)
  returning id, tracking_number into sid, tn;

  insert into public.tracking_events (shipment_id, status, comment, actor_id)
  values (sid, 'transmise_chine', 'Colis créé', auth.uid());

  return tn;
end;
$$;

-- Changement de statut : chaque rôle ne peut faire que sa propre étape
create or replace function public.set_shipment_status(p_id uuid, p_status text, p_comment text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare cur text; allowed boolean;
begin
  select status into cur from public.shipments where id = p_id;
  if not found then raise exception 'Colis introuvable'; end if;

  allowed := public.has_role('administrateur_principal')
    or (public.has_role('agent_chine') and ((cur = 'transmise_chine' and p_status = 'achat_effectue')
                                         or (cur = 'achat_effectue' and p_status = 'recu_chine')))
    or (public.has_role('responsable_logistique') and ((cur = 'recu_chine' and p_status = 'expedie')
                                                    or (cur = 'expedie' and p_status = 'arrive_togo')))
    or (public.has_role('agent_livraison') and ((cur = 'arrive_togo' and p_status = 'en_livraison')
                                             or (cur = 'en_livraison' and p_status = 'livre')));
  if not allowed then raise exception 'Cette étape n’est pas autorisée pour votre rôle'; end if;

  update public.shipments set status = p_status where id = p_id;
  insert into public.tracking_events (shipment_id, status, comment, actor_id)
  values (p_id, p_status, nullif(trim(coalesce(p_comment, '')), ''), auth.uid());
end;
$$;

revoke execute on function public.create_shipment(uuid, uuid) from public, anon;
revoke execute on function public.set_shipment_status(uuid, text, text) from public, anon;
grant execute on function public.create_shipment(uuid, uuid) to authenticated;
grant execute on function public.set_shipment_status(uuid, text, text) to authenticated;

-- Droits
alter table public.product_colors enable row level security;
alter table public.shipments enable row level security;
alter table public.tracking_events enable row level security;

drop policy if exists product_colors_public_read on public.product_colors;
create policy product_colors_public_read on public.product_colors
  for select to anon, authenticated using (true);
drop policy if exists product_colors_staff_write on public.product_colors;
create policy product_colors_staff_write on public.product_colors
  for all to authenticated using (public.can_manage_catalogue()) with check (public.can_manage_catalogue());

-- Le client voit ses colis ; le personnel logistique voit tous les colis
drop policy if exists shipments_select on public.shipments;
create policy shipments_select on public.shipments
  for select to authenticated using (user_id = auth.uid() or public.is_logistics_staff());

drop policy if exists tracking_events_select on public.tracking_events;
create policy tracking_events_select on public.tracking_events
  for select to authenticated using (
    exists (select 1 from public.shipments s
            where s.id = shipment_id and (s.user_id = auth.uid() or public.is_logistics_staff()))
  );

-- Le personnel logistique voit aussi le nom des clients (nécessaire à l'affichage)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.has_role('administrateur_principal')
    or public.can_verify_payments()
    or public.is_logistics_staff()
  );
