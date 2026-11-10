-- ==========================================================================
-- phase10-notifications.sql — Viva Shop — Notifications dans l'application
-- À exécuter après phase9-annonces.sql. Les notifications sont créées par la base
-- (déclencheurs) ; le client ne peut que les lire et les marquer comme lues.
-- ==========================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  body text check (body is null or char_length(body) <= 500),
  link text check (link is null or char_length(link) <= 200),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.notify(p_user uuid, p_title text, p_body text, p_link text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.notifications (user_id, title, body, link) values (p_user, p_title, p_body, p_link);
$$;
revoke execute on function public.notify(uuid, text, text, text) from public, anon, authenticated;

-- Libellés des statuts de paiement
create or replace function public.payment_label(p text)
returns text
language sql immutable
as $$
  select case p
    when 'en_cours_verification' then 'en cours de vérification'
    when 'paiement_confirme' then 'confirmé'
    when 'montant_incorrect' then 'signalé : montant incorrect'
    when 'transaction_introuvable' then 'signalé : transaction introuvable'
    when 'declaration_rejetee' then 'rejeté'
    when 'rembourse' then 'remboursé'
    else 'en attente de vérification'
  end;
$$;

-- Paiements : déclaration reçue, puis chaque changement de statut
create or replace function public.notify_payment()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.user_id, 'Déclaration reçue',
      'Votre déclaration ' || new.order_number || ' a bien été reçue. Notre équipe la vérifie.', '#/commandes');
  elsif new.status is distinct from old.status then
    perform public.notify(new.user_id, 'Paiement ' || public.payment_label(new.status),
      'Commande ' || new.order_number || '.', '#/commandes');
  end if;
  return null;
end;
$$;

drop trigger if exists payments_notify on public.payment_declarations;
create trigger payments_notify
  after insert or update of status on public.payment_declarations
  for each row execute function public.notify_payment();

-- Réservations
create or replace function public.notify_reservation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.notify(new.user_id, 'Réservation enregistrée',
    'Ce n’est pas un paiement. Vous serez prévenu à l’ouverture de la collecte.', '#/commandes');
  return null;
end;
$$;

drop trigger if exists reservations_notify on public.reservations;
create trigger reservations_notify
  after insert on public.reservations
  for each row execute function public.notify_reservation();

-- Colis : chaque étape et chaque date communiquée
create or replace function public.notify_tracking()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare owner uuid; etape text;
begin
  select user_id into owner from public.shipments where id = new.shipment_id;
  etape := case new.status
    when 'transmise_chine' then 'transmis à l’agent en Chine'
    when 'achat_effectue' then 'achat effectué'
    when 'recu_chine' then 'reçu en Chine'
    when 'expedie' then 'expédié vers le Togo'
    when 'arrive_togo' then 'arrivé au Togo'
    when 'en_livraison' then 'en cours de livraison'
    when 'livre' then 'livré'
    else null
  end;
  if etape is not null then
    perform public.notify(owner, 'Votre colis : ' || etape,
      coalesce(new.comment, 'Consultez Mes colis pour le détail.'), '#/commandes');
  end if;
  return null;
end;
$$;

drop trigger if exists tracking_notify on public.tracking_events;
create trigger tracking_notify
  after insert on public.tracking_events
  for each row execute function public.notify_tracking();

-- Ouverture d'une campagne : prévenir ceux qui suivent un de ses produits
create or replace function public.notify_campaign()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.state = 'ouverte' then
    insert into public.notifications (user_id, title, body, link)
    select distinct f.user_id, 'Collecte ouverte : ' || new.name,
           'Un produit que vous suivez peut maintenant être réservé et payé.', '#/favoris'
    from public.favorites f
    join public.campaign_products cp on cp.product_id = f.product_id
    where cp.campaign_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists campaigns_notify on public.campaigns;
create trigger campaigns_notify
  after update of state on public.campaigns
  for each row when (old.state is distinct from new.state)
  execute function public.notify_campaign();

-- Droits : chacun lit ses notifications et marque ses lectures ; personne ne les crée
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;
